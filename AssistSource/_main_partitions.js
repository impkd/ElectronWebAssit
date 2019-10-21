'use strict';

/**
 * Created by pkd on 2019/10/26.
 * Partitions 相关的功能，
 * 一个Partition相当于一个独立的浏览器，不同partition之间的cookie、storage等都是不通用的。
 *
 */
var electron = require('electron');
var app = electron.app;
var session = electron.session;
var AllPartition = module.exports;

var path = require('path');
var utils = require('./_main_utils.js');
var fs = require('fs');
var TargetMng = require('./_main_targets.js');

AllPartition.ListenUrls = ['*'];


AllPartition.onExit = function () {
    for(var plt in platform2loginer){
        var loginer = platform2loginer[plt];
        if(!loginer) continue;
        loginer.onExit();
    }
};

function setCookieToSession(cookie, ses, cb) {
    var url = cookie.url;
    if(!url){
        if(cookie.domain.substr(0, 1) == '.'){
            url = 'http://*' + cookie.domain;
        }
        else{
            url = 'http://' + cookie.domain;
        }
    }
    var ck = {
        url:url,
        name:(cookie.name),
        value:(cookie.value),
        domain:cookie.domain,
        path:cookie.path,
    };
    ses.cookies.set(ck, cb);
}

function backupCookies(session, partitionName, domain, discassName, cb) {

    session.cookies.get({},  function(error, cookies) {
        if(error){
            if(cb)cb(error, cookies);
            return;
        }

        var ufCookies = {};
        cookies.forEach(function(value) {
            var vd = value.domain;
            if(!vd) return;

            console.log('cookie:' + vd + ' ### ' + value.name + ' ### ' + value.value);

            if((!domain || vd.indexOf(domain) >= 0) && (!discassName || new RegExp(discassName, 'i').test(value.name) ) ){
                var key = value.name + '###' + value.domain;
                ufCookies[key] = {name:value.name, domain:value.domain, path:value.path, value:value.value};
            }
        });
        var usefullCookies = [];
        for(var k in ufCookies) usefullCookies.push(ufCookies[k]);

        var partitionCfgFile = path.join(app.userDataFolder, partitionName.replace(':', ''));
        fs.writeFile(partitionCfgFile, JSON.stringify(usefullCookies), function (err) {
            if (err){
                console.log(err);
                if(cb)cb(error, cookies);
                return;
            }
            console.log("备份成功！");
            if(cb)cb(null, cookies);
        });
    });
}

function restoreCookie1by1(cks, curIdx, ses, cb) {
    if(curIdx >= cks.length){
        ses.cookies.flushStore(function(error, a1) {
            if(cb)cb();
        });
        return;
    }
    setCookieToSession(cks[curIdx], ses, function () {
        restoreCookie1by1(cks, curIdx + 1, ses, cb);
    });
}
function restoreCookies(partitionName, ses, cb) {
    var partitionCfgFile = path.join(app.userDataFolder, partitionName.replace(':', ''));

    fs.readFile(partitionCfgFile, 'utf8', function (err, data) {
        if (err) {
            if(err.errno != -4058){
                console.log(err);
            }
            if(cb) cb(err);
            return
        }
        try{
            if(!data) {
                if(cb) cb(err);
                return;
            }
            var cks = JSON.parse(data);
            ses.cookies.flushStore(function(error, a1) {
                restoreCookie1by1(cks, 0, ses, cb);
            });
        }
        catch(e){
            console.log(e);
        }
    });
}

AllPartition.PartitionAddRef = function (partitionName, cb) {

    if(!AllPartition.allInitedPartitions){
        AllPartition.allInitedPartitions = {};
    }
    if(AllPartition.allInitedPartitions[partitionName]){
        ++AllPartition.allInitedPartitions[partitionName];
        if(cb) cb(AllPartition.allInitedPartitions[partitionName]);
        return;
    }
    AllPartition.allInitedPartitions[partitionName] = 1;

    var ses = electron.session.fromPartition(partitionName);
    restoreCookies(partitionName, ses, function () {
        ses.webRequest.onBeforeRequest({urls:['*://*/*']}, TargetMng.onBeforeRequest);
        ses.webRequest.onHeadersReceived({urls:['*://*/*']}, TargetMng.onHeadersReceived);
        ses.webRequest.onCompleted({urls:['*://*/*']}, TargetMng.onCompleted);
        ses.on('will-download', TargetMng.onWillDownload);
        if(cb) cb(1);
    });
};

AllPartition.PartitionDelRef = function (instance) {
    if(AllPartition.allInitedPartitions[instance.partition]){
        --AllPartition.allInitedPartitions[instance.partition];
        if(AllPartition.allInitedPartitions[instance.partition] <= 0){
            delete AllPartition.allInitedPartitions[instance.partition];

            const ses = session.fromPartition(instance.partition);
            ses.flushStorageData();
            backupCookies(ses, instance.partition);
        }
        return;
    }
};
