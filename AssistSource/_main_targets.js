'use strict';
/**
 * Created by pkd on 2019/10/26.
 * 平台相关的功能
 *
 */

var utils = require('./_main_utils.js');
var PartitionMng = require('./_main_partitions.js');
var electron = require('electron');
var BrowserWindow = electron.BrowserWindow;
var app = electron.app;
var path = require('path');
var fs = require('fs');

var TargetMng = module.exports;

TargetMng.LoadAllInstance = function (cb) {
    TargetMng.allTargets = {};
    TargetMng.allInstances = [];

    fs.readdir(path.join(__dirname, 'target/'), function(err, files) {
        if (err) {
            console.log('error:' + err);
            if(cb) cb(err);
            return;
        }
        var targetBasePath = path.join(__dirname, 'target/');
        files.forEach(function (file) {
            if(!file.match(/\.js$/ig)){
                return;
            }
            var fullPathName = path.join(targetBasePath, file);
            try{
                var stat;
                stat = fs.lstatSync(fullPathName, function (err) {});
                if (stat === undefined) return;
                if (stat.isDirectory()) {
                    return;
                }
            }catch(e){
                if(e.errno != -4058){
                    console.log(e);
                }
                return;
            }

            var target = require(fullPathName);
            if(!target && target.name) return;

            target.allInstances = [];
            TargetMng.allTargets[target.name] = target;
        });

        if(cb) cb();
    });
};
TargetMng.onPlatAjaxRsp = function (win, jobKey, isSuc, rspObj) {
    if(!win || !win.webContents) return;
    var jsStr = '$_$.onIpcRsp("' + jobKey + '", ' +
        (isSuc ? 1 : 0) + (
            rspObj ? (', ' + (JSON.stringify(rspObj).replace(/'/igm, '\\\'')) + '') : '') +
        ');';
    win.webContents.executeJavaScript(jsStr, true, function (rsp) {
    });
};

// 收到IPC消息时的处理主入口，在此处理完系统级之后，分给不同的平台去处理。
TargetMng.onIpcMsg = function(instance, msg) {
    if(msg.dstWindowId == -1){
        if(msg.cmd == 'queryWindow'){
            var allInst = [];
            var urlReg = new RegExp(msg.urlReg || '.', 'im');

            TargetMng.allInstances.forEach(function (inst) {
                if(inst.window && inst.window.webContents) {
                    var url = inst.window.getURL();
                    if(url.match(urlReg)){
                        var partition = inst.partition;
                        allInst.push({id:inst.window.webContents.id, url:url, partition:partition});
                    }
                }
            });
            var rsp = {inst:allInst, me:{id:instance.window.webContents.id, partition:instance.partition}};
            TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 1, (rsp));
        }
        else if(msg.cmd == 'openWindow'){
            TargetMng.CreateInstance(msg.target, msg.url, msg.partition, function (err, inst) {
                var rsp = {};
                if(inst && inst.window && inst.window.webContents) rsp.id = inst.window.webContents.id;
                TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, err ? 0 : 1, rsp);
            });
        }
        else if(msg.cmd == 'setAppVar'){
            if(!msg.keys || msg.keys.length < 1){
                TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 0, '必须指定 keys , 数组类型');
                return;
            }
            var keys = msg.keys;
            var toSet = app;
            for(var i = 0; i < keys.length; ++i){
                var k = keys[i];
                if(i === keys.length - 1){
                    toSet[k] = msg.dat;
                    break;
                }

                if(!toSet.hasOwnProperty(k)){
                    toSet[k] = {};
                }
                toSet = toSet[k];
            }
            TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 1, ({}));
        }
        else if(msg.cmd == 'getAppVar'){
            var rsp = {};
            var keyArys = msg.dat;
            keyArys.forEach(function (keys) {
                var toSet = {};
                var toGet = app;
                for(var i = 0; i < keys.length; ++i){
                    var k = keys[i];
                    if(i === keys.length - 1){
                        toSet[k] = toGet[k];
                        break;
                    }

                    if(!toGet.hasOwnProperty(k)){
                        break;
                    }
                    if(!toSet.hasOwnProperty(k)){
                        toSet[k] = {};
                    }
                    toSet = toSet[k];
                    toGet = toGet[k];
                }
            });

            TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 1, (rsp));
        }
        else if(msg.cmd == 'sendInput'){
            if(msg.toWinId){
                var toInst = TargetMng.FindTargetByWebContentsId(msg.toWinId);
                if(!toInst){
                    TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 0, '未找到目标窗口');
                    return;
                }
                instance.window.webContents.sendInputEvent(msg.dat);
                TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 1, ({}));
                return;
            }
            instance.window.webContents.sendInputEvent(msg.dat);
            TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 1, ({}));
        }
    }
    else{
        var toInst = TargetMng.FindTargetByWebContentsId(msg.dstWindowId);
        if(!toInst || !toInst.window || !toInst.window.webContents) {
            TargetMng.onPlatAjaxRsp(instance.window, msg.jobKey, 0, '未找到目标窗口');
            return;
        }
        var jsStr = '$_$.onIpcMsg(' + instance.window.webContents.id + ', "' +
            msg.jobKey + '", ' + (JSON.stringify(msg).replace(/'/igm, '\\\'')) + ' );';
        toInst.window.webContents.executeJavaScript(jsStr, true, function (rsp) {
        });
        // 此处不会回应，因为目标窗口会返回数据。超时处理在原始窗口那边。
    }
};

// 根据窗口的ID查找对象
TargetMng.FindTargetByWebContentsId = function (webContentsId) {
    var instance = undefined;
    TargetMng.allInstances.some(function (i) {
        if(i.window && i.window && i.window.webContents && i.window.webContents.id == webContentsId){
            instance = i;
            return true;
        }
    });
    return instance;
};


// 发起请求前处理，可以取消
TargetMng.onBeforeRequest = function(details, callback) {
    var urlObj = utils.parseURL(details.url);
    var urlHosts = urlObj.host;
    if(app.ForbidenOrIgnoreReqUrl.some(function (t) {
            if(urlHosts.indexOf(t) >= 0){
                return true;
            }
        })){callback({cancel: true});return;};

    var instance = (details && details.webContentsId) ? TargetMng.FindTargetByWebContentsId(details.webContentsId) : undefined;
    if (!instance || !instance.target) {
        callback({cancel: false});
        return;
    }

    if(details.url.substring(0, app.ipcUrl.length) == app.ipcUrl){
        var pd = utils.decodePostData(details);
        if(pd && pd.length > 0){
            var params = utils.testParseAsJSON(decodeURIComponent(pd[0]));
            TargetMng.onIpcMsg(instance, params);
        }
        callback({cancel: true});
        return;
    }

    if (instance.target.onBeforeRequest) {
        var cancel = instance.target.onBeforeRequest(instance, details);
        callback({cancel: cancel ? true : false});
        return;
    }
    callback({cancel: false});
};


// 收到头部信息，可以在此处理后再给浏览器
TargetMng.onHeadersReceived = function(details, callback) {
    var instance = (details && details.webContentsId) ? TargetMng.FindTargetByWebContentsId(details.webContentsId) : undefined;
    if (!instance || !instance.target || !instance.target.onHeadersReceived) {
        callback({cancel: false});
        return;
    }
    instance.target.onHeadersReceived(instance, details, callback);
};

// 请求已完成，不可以取消
TargetMng.onCompleted = function(details) {
    var instance = (details && details.webContentsId) ? TargetMng.FindTargetByWebContentsId(details.webContentsId) : undefined;
    if (!instance || !instance.target || !instance.target.onCompleted) {
        return;
    }
    instance.target.onCompleted(instance, details);
};


// 开始下载之前调用，可以设置保存位置，监听进度
TargetMng.onWillDownload = function(event, item, webContents) {
    var instance = (webContents && webContents.id) ? TargetMng.FindTargetByWebContentsId(webContents.id) : undefined;
    if (!instance || !instance.target || !instance.target.onWillDownload) {
        return;
    }
    if(instance.target.onWillDownload(instance, event, item, webContents)){
        event.preventDefault();
        return;
    }
};

// 即将打开新窗口
TargetMng.onNewWindow = function(instance, event, url, frameName, disposition, options) {
    for(var k in TargetMng.allTargets){
        var target = TargetMng.allTargets[k];
        if(!target.UrlKeyRegs) continue;
        var hasMatch = target.UrlKeyRegs.some(function (value) {
            if(value.test(url)) return true;
            return false;
        });
        if(hasMatch){
            TargetMng.CreateInstance(k, url, instance.partition);
            event.preventDefault();
            return true;
        }
    }
    // instance.target.CreateInstance(url, instance.partition);
    // event.preventDefault();
    // var win = instance.window;
    // win.once('ready-to-show', function() { win.show();});
    // event.newGuest = instance.window;
    // return true;
};

// 即将关闭窗口
TargetMng.onClose = function(instance) {
    PartitionMng.PartitionDelRef(instance);
    if(instance.target.onClose){
        instance.target.onClose(instance);
    }
    for(var i = instance.target.allInstances.length - 1; i >= 0; --i){
        if(instance.target.allInstances[i] == instance){
            instance.target.allInstances.splice(i, 1);
        }
    }
    for(var i = TargetMng.allInstances.length - 1; i >= 0; --i){
        if(TargetMng.allInstances[i] == instance){
            TargetMng.allInstances.splice(i, 1);
        }
    }
};

// 窗口即将跳转
TargetMng.WillNavigate = function(instance, event, newURL) {
    if(instance.target.WillNavigate){
        return instance.target.WillNavigate(instance, event, newURL);
    }
};

function TestAndInitHookJs(instance, cb) {

    app.insertHookJs(instance.window.webContents, path.join(__dirname, "./jquery-2.1.4.min.js"), function () {
        app.insertHookJs(instance.window.webContents, path.join(__dirname, "./plat_ipc.js"), function () {
            var jsStr = 'window.$_$.ipcUrl = "' + app.ipcUrl + '";';
            instance.window.webContents.executeJavaScript(jsStr, true).then(function (rsp) {});
            if(cb) cb();
        });
    });

}

// 窗口跳转
TargetMng.DidRedirectNavigate = function(instance, event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) {
    if(instance.target.DidRedirectNavigate){
        return instance.target.DidRedirectNavigate(instance, event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId);
    }
};

// 窗口加载
TargetMng.onStartLoad = function(instance) {
    if(instance.target.onStartLoad){
        return instance.target.onStartLoad(instance);
    }
};

// 窗口加载完成
TargetMng.onDomReady = function(instance) {
    TestAndInitHookJs(instance, function () {

        if(instance.target.jsFileOnDoomReady && instance.window && instance.window.webContents){
            app.insertHookJs(instance.window.webContents, instance.target.jsFileOnDoomReady, function () {
                var jsStr = 'window.$_$.ipcUrl = "' + app.ipcUrl + '";';
                instance.window.webContents.executeJavaScript(jsStr, true).then(function (rsp) {});

                if(instance.target.onDomReady && instance.window && instance.window.webContents){
                    return instance.target.onDomReady(instance);
                }
            });
        }
        else{
            if(instance.target.onDomReady && instance.window && instance.window.webContents){
                return instance.target.onDomReady(instance);
            }
        }
    });
};

// 窗口加载完成
TargetMng.onFinishLoad = function(instance) {
    if(instance.target.onFinishLoad && instance.window && instance.window.webContents){
        return instance.target.onFinishLoad(instance);
    }
};

// 创建实例，param中可以指定使用的partition、归属的Target、窗口大小等信息。
// 未指定Target时，会根据URL来决定Target.
// 默认使用与父窗口同样的partition
TargetMng.CreateInstance = function (targetName, url, partition, cb) {
    var target = TargetMng.allTargets[targetName];
    if(!target || !target.UrlKeyRegs){
        if(cb) cb('target not found! ' + targetName);
        return;
    }

    var instance = {target:target};

    TargetMng.allInstances.push(instance);
    target.allInstances.push(instance);

    instance.winOption = {
        title:'【 ElectronWebAssist 】V ' + app.appVer,
        webPreferences:{
            partition: partition || app.defaultPartition,
            preload:target.jsFileBeforLoad,
            allowDisplayingInsecureContent:true,
            allowRunningInsecureContent:true,
            nodeIntegration:false,
            // sandbox: true
        },
        width: 1440,
        height: 900,
        hasShadow: true,
        // kiosk:true,  //满屏幕，并且不能通过操作解除
        frame:false,
        // resize:false,
    };
    instance.initUrl = url;

    instance.urlOptions = {
        httpReferrer: 'about:blank',
        extraHeaders:'',
        userAgent:app.USER_AGENT
    };

    if(target.BeforeCreateInstance){
        target.BeforeCreateInstance(instance);
    }
    instance.partition = instance.winOption.webPreferences.partition;
    PartitionMng.PartitionAddRef(instance.partition, function () {

        instance.window = new BrowserWindow(instance.winOption);
        instance.window.loadURL(instance.initUrl, instance.urlOptions);

        instance.window.setThumbarButtons([]);      //清空缩略图工具栏：
        instance.window.setProgressBar(1);
        instance.window.setMenuBarVisibility(false);

        instance.window.on('closed', function () {
            instance.window = null;
            if(!TargetMng.onClose) return;
            TargetMng.onClose(instance);
        });

        var webContents = instance.window.webContents;
        // webContents.openDevTools();

        webContents.on('will-navigate', function (event, newURL) {
            if(!TargetMng.WillNavigate) return;
            TargetMng.WillNavigate(instance, event, newURL);
        });
        webContents.on('did-start-navigation', function (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) {
            if(!TargetMng.DidStartNavigate) return;
            TargetMng.DidStartNavigate(instance, event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId);
        });
        webContents.on('did-redirect-navigation', function (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) {
            if(!TargetMng.DidRedirectNavigate) return;
            TargetMng.DidRedirectNavigate(instance, event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId);
        });
        webContents.on('did-start-loading', function () {
            if(!TargetMng.onStartLoad) return;
            TargetMng.onStartLoad(instance);
        });
        webContents.on('did-finish-load', function () {
            if(!TargetMng.onFinishLoad) return;
            TargetMng.onFinishLoad(instance);
        });
        webContents.on('dom-ready', function () {
            if(!TargetMng.onDomReady) return;
            TargetMng.onDomReady(instance);
        });
        webContents.on('new-window', function (event, url, frameName, disposition, options) {
            if(!TargetMng.onNewWindow) return false;
            return TargetMng.onNewWindow(instance, event, url, frameName, disposition, options);
        });

        if(cb) cb(null, instance);
    });
};

