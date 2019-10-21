'use strict';
/**
 * Created by pkd on 2017/10/26.
 * 一些通用功能
 *
 */

var utils = module.exports;
var urlMod = require('url');
var path = require('path');
var fs = require("fs");

utils.removeUpper = function (str) {
    return str.replace(/[A-Z]/gm, '');
};
utils.stringToByte = function (str) {
    var bytes = new Array();
    var len, c;
    len = str.length;
    for(var i = 0; i < len; i++) {
        c = str.charCodeAt(i);
        if(c >= 0x010000 && c <= 0x10FFFF) {
            bytes.push(((c >> 18) & 0x07) | 0xF0);
            bytes.push(((c >> 12) & 0x3F) | 0x80);
            bytes.push(((c >> 6) & 0x3F) | 0x80);
            bytes.push((c & 0x3F) | 0x80);
        } else if(c >= 0x000800 && c <= 0x00FFFF) {
            bytes.push(((c >> 12) & 0x0F) | 0xE0);
            bytes.push(((c >> 6) & 0x3F) | 0x80);
            bytes.push((c & 0x3F) | 0x80);
        } else if(c >= 0x000080 && c <= 0x0007FF) {
            bytes.push(((c >> 6) & 0x1F) | 0xC0);
            bytes.push((c & 0x3F) | 0x80);
        } else {
            bytes.push(c & 0xFF);
        }
    }
    return bytes;
};
utils.byteToString = function (arr) {
    if(typeof arr === 'string') {
        return arr;
    }
    var str = '',
        _arr = arr;
    for(var i = 0; i < _arr.length; i++) {
        var one = _arr[i].toString(2),
            v = one.match(/^1+?(?=0)/);
        if(v && one.length == 8) {
            var bytesLength = v[0].length;
            var store = _arr[i].toString(2).slice(7 - bytesLength);
            for(var st = 1; st < bytesLength; st++) {
                store += _arr[st + i].toString(2).slice(2);
            }
            str += String.fromCharCode(parseInt(store, 2));
            i += bytesLength - 1;
        } else {
            str += String.fromCharCode(_arr[i]);
        }
    }
    return str;
};
utils.decodeUploadDataPairs = function (details) {
    var toRet = {};
    var pairs = utils.decodePostData(details);
    pairs.forEach(function (str) {
        var kv = str.split('=');
        if(kv.length < 2 || !kv[0]) return;
        var names = kv[0].trim('. ').split('.');
        var toSet = toRet;
        for(var i = 0; i <= names.length - 1; ++i){
            var n = decodeURIComponent(names[i]);
            if(!n) continue;
            if(i == names.length - 1){
                toSet[n] = decodeURIComponent(kv[1] || '');
            }
            else{
                toSet = toSet[n];
            }
        }
    });
    return toRet;
};
utils.decodePostData = function (details) {
    if(!details || !details.uploadData || !(details.uploadData instanceof Array)) return {};
    if(details.uploadData.length <= 0) return {};
    var strData = details.uploadData[0].bytes.toString();
    var pairs = strData.split('&');
    return pairs;
};
function stringToBytes ( str ) {
    var ch, st, re = [];
    for (var i = 0; i < str.length; i++ ) {
        ch = str.charCodeAt(i);  // get char
        st = [];                 // set up "stack"
        do {
            st.push( ch & 0xFF );  // push byte to stack
            ch = ch >> 8;          // shift value down by 1 byte
        }
        while ( ch );
        // add stack contents to result
        // done because chars have "wrong" endianness
        re = re.concat( st.reverse() );
    }
    // return an array of bytes
    return re;
}

utils.encodeUploadDataPairs = function (details, param) {
    var allKV = [];
    for(var k in param){
        allKV.push(encodeURIComponent(k) + '=' + encodeURIComponent(param[k]));
    }
    var allKVStr = allKV.join('&');
    details.uploadData[0] = stringToBytes(allKVStr);
};
utils.switchInStr = function (val, a, b) {
    val = val.replace(new RegExp(a, 'g'), '\\');
    val = val.replace(new RegExp(b, 'g'), a);
    val = val.replace(/\\/g, b);
    return val;
};

utils.randomString = function (len) {
    len = len || 32;
    var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    var maxPos = $chars.length;
    var pwd = '';
    for (var i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
};
/**
 * 分析URL，可以解出类似协议(http)，参数等。必须是标准的URL。
 */
utils.parseURL = function (url) {
    var a =  urlMod.parse(url);
    if(!a.href) a.href = '';
    if(!a.hash) a.hash = '';
    if(!a.search) a.search = '';
    if(!a.protocol) a.protocol = '';
    if(!a.pathname) a.pathname = '';
    if(!a.search) a.search = '';
    if(!a.hostname) a.hostname = '';
    return {
        source: url,
        protocol: a.protocol.replace(':',''),
        host: a.hostname,
        port: a.port,
        query: a.search,
        params: (function(){
            var ret = {},
                seg = a.search.replace(/^\?/,'').split('&'),
                len = seg.length, i = 0, s;
            for (;i<len;i++) {
                if (!seg[i]) { continue; }
                s = seg[i].split('=');
                ret[s[0]] = s[1];
            }
            return ret;
        })(),
        file: (a.pathname.match(/\/([^\/?#]+)$/i) || [,''])[1],
        hash: a.hash.replace('#',''),
        path: a.pathname.replace(/^([^\/])/,'/$1'),
        relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [,''])[1],
        segments: a.pathname.replace(/^\//,'').split('/')
    };
};
utils.urlIfy = function (obj) {
    var ret = obj.protocol + '://' + obj.host;
    if(obj.port) ret += ':' + obj.port;
    if(obj.path) ret += obj.path;
    if(obj.params){
        ret += '?';
        var NeedParamSep = false;
        for(var k in obj.params){
            if(NeedParamSep) {
                ret += '&';
            }
            else{
                NeedParamSep = true;
            }
            ret += k + '=' + obj.params[k];
        }
    }
    return ret;
};

utils.convertToUnicode = function (data) {
    data = decodeURIComponent(data);
    var reg = /\\u[0-9a-f]{4}/igm;
    return data.replace(reg, function () {
        return String.fromCharCode(parseInt(arguments[0].substr(2, 4),16).toString())
    });
}

String.prototype.parseURL = function () {
    return utils.parseURL(this);
};

utils.replaceParam = function (url, name, val) {
    var urlObj = utils.parseURL(url);
    if(!urlObj.params) urlObj.params = {};
    urlObj.params[name] = val;
    return utils.urlIfy(urlObj);
}

utils.testParseAsJSON = function (str) {
    if (typeof str == 'string') {
        try {
            var obj = JSON.parse(str);
            return obj;
        } catch(e) {
            return undefined;
        }
    }
}

utils.removePathAndChild = function(toRm) {
    var stat;
    try{
        stat = fs.lstatSync(toRm, function (err) {});
    }catch(e){
        if(e.errno != -4058){
            console.log(e);
        }
        return;
    }
    if (stat === undefined) return;
    if (!stat.isDirectory()) {
        fs.unlink(toRm);
        return;
    }

    fs.readdir(toRm, function(err, files) {
        if (err) {
            console.log('error:' + err);
            return;
        }
        files.forEach(function (file) {
            var child = path.join(toRm, file);
            app.utils.removePathAndChild(child)
        });
        fs.rmdir(toRm, function (error) {
            console.log(error);
        });
    });
};
