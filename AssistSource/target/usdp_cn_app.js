'use strict';
/**
 * Created by pkd on 2019/12/20.
 * 运行于主进程
 *
 */

var utils = require('../_main_utils.js');
var path = require('path');
var urlMod = require('url');
var electron = require('electron');
var app = electron.app;
var UsdpCnApp = module.exports;


UsdpCnApp.name = 'UsdpCn';
UsdpCnApp.jsFileBeforLoad = path.join(__dirname, 'js/usdp_cn_before_load.js');
UsdpCnApp.jsFileOnDoomReady = path.join(__dirname, 'js/usdp_cn_hook.js');

// 符合以下条件的URL，如果在新窗口中打开，会被认为是一个UsdpCnApp
UsdpCnApp.UrlKeyRegs = [ /\.usdp\.cn/i, ];

// 在TargetMng创建实例前，允许具体的管理器调整参数
UsdpCnApp.BeforeCreateInstance = function (instance) {
    if(!instance.winOption.webPreferences){
        instance.winOption.webPreferences = {};
    }
    instance.winOption.title = '【 ElectronWebAssist 】V ' + app.appVer;
    instance.winOption.webPreferences.preload = UsdpCnApp.jsFileBeforLoad;
    instance.winOption.webPreferences.nodeIntegration = false;
    instance.winOption.webPreferences.sandbox = false;  // 设置TRUE将无法执行 executeJavaScript
    instance.winOption.frame = true;

};

UsdpCnApp.onDomReady = function(instance) {
    if(!instance.window || !instance.window.webContents) return;

    // 设置 20 分钟 自动刷新一次页面
    var jsStr = '$_$.setAutoReload(1200000);';
    instance.window.webContents.executeJavaScript(jsStr, true).then(function (rsp) {});
};

// 窗口加载完成
UsdpCnApp.onFinishLoad = function(instance) {

};

UsdpCnApp.WillNavigate = function(instance, event, newURL) {
    if(app.cancelNavigate){
        event.preventDefault();
    }
};

// 请求已完成，不可以取消 https://www.anyip.net/about.html
UsdpCnApp.onCompleted = function(instance, details) {
    if(details.url.match(/anyip\.net\.about\.html/i)){
        setTimeout(function () {
            if(!instance.window || !instance.window.webContents) return;
            var jsStr = 'if(window.checkBalanceInHomePage) window.checkBalanceInHomePage();';
            instance.window.webContents.executeJavaScript(jsStr, true).then(function (rsp) {
                // console.log(rsp);
            });
        }, 100);
    }
};

// 发起请求前处理，可以取消
UsdpCnApp.onBeforeRequest = function(instance, details) {
};