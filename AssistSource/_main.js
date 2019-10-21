'use strict';
/**
 * Created by pkd on 2019/12/20.
 * 主进程入口，用于创建主窗口，设置主窗口，以及一些常规设置
 *
 */

var electron = require('electron');
var TargetMng = require('./_main_targets.js');
var AnyipNet = require('.\\target\\anyip_net_app.js');
var UsdpCn = require('.\\target\\usdp_cn_app.js');

var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var powerSaveBlocker = electron.powerSaveBlocker;
var globalShortcut = electron.globalShortcut;
var path = require('path');
var utils = require('./_main_utils.js');
var fs = require('fs');


app.appVer = '1.00';
app.defaultPartition = 'persist:default';
app.defaultPlatformPartition = 'persist:';
app.USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 Safari/537.36';

// 这里面的所有URL请求都会被屏蔽
app.ForbidenOrIgnoreReqUrl = [];

// 指定一个不存在的域名和目录，用于IPC通讯
app.ipcUrl = 'https://plat_ipc/';

app.tempFolder = path.join(app.getPath('temp'), 'el_assist');
app.userDataFolder = path.join(app.getPath('userData'), 'el_assist');

fs.stat(app.tempFolder, function (err, stats) {
    if(!stats){
        try{
            fs.mkdir(app.tempFolder, function (err) {
                if(err) console.log(err);
            });
        }catch(e){
            console.log(e);
        }
    }
});
fs.stat(app.userDataFolder, function (err, stats) {
    if(!stats){
        try{
            fs.mkdir(app.userDataFolder, function (err) {
                if(err) console.log(err);
            });
        }catch(e){
            console.log(e);
        }
    }
});


app.insertHookJs = function (webContents, file, cb) {
    var rf = require("fs");
    rf.readFile(file,'utf-8',function(err, jsStr){
        if(err){
            if(cb)cb(err);
        }else{
            if(webContents) webContents.executeJavaScript(jsStr, true, function (rsp) {
                if(cb)cb(null, rsp);
            });
        }
    });
};

function initProtocol() {
    var protocol = electron.protocol;
    protocol.interceptFileProtocol('file', function(request, callback) {
        var url = request.url.substr(8);
        if (url.charAt(1) != ':'){
            callback({path: path.join(__dirname, '\\blank')});
            return;
        }
        else{
            var stopAt = url.indexOf('?');
            if(stopAt >= 0) url = url.substr(0, stopAt);
            callback({path: decodeURIComponent(url)});
        }
    }, function (error) {
        if (error)
            console.error('Failed to register File protocol')
    });
}

app.preventSleep = function() {
    if(app.preventSleepId) return;
    app.preventSleepId = powerSaveBlocker.start('prevent-display-sleep');
};

app.allowSleep = function() {
    if(!app.preventSleepId) return;
    powerSaveBlocker.stop(preventSleepId);
    delete app.preventSleepId;
};

var gotTheLock = false;
if(app.makeSingleInstance){ //app.requestSingleInstanceLock
    var shouldQuit = app.makeSingleInstance(function (commandLine, workingDirectory) {

    });
    gotTheLock = shouldQuit ? false : true;
}
else {
    gotTheLock = app.requestSingleInstanceLock();
}

if (!gotTheLock) {
    app.quit();
}
else{
    app.on('ready', function () {
        initProtocol();
        utils.removePathAndChild(app.tempFolder);

        TargetMng.LoadAllInstance(function () {
            TargetMng.CreateInstance(AnyipNet.name, 'http://anyip.net/');
            TargetMng.CreateInstance(UsdpCn.name, 'http://usdp.cn/');
        });

        app.preventSleep();
    });

    app.clearRecentDocuments();     //清空最近文件列表。
    app.setUserTasks([]);           //清除你的任务列表：

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') {
            setTimeout(function () {
                app.quit();
            }, 3000);
        }
    });

    app.on('activate', function () {
    });

    app.on('will-quit', function () {
        globalShortcut.unregisterAll();
    });

    var Menu = electron.Menu;
    var MenuItem = electron.MenuItem;
    var menu = new Menu();
    menu.append(new MenuItem({label:'复制', accelerator: 'CmdOrCtrl+C',role:'copy'}));
    menu.append(new MenuItem({label:'粘贴',accelerator: 'CmdOrCtrl+V',role:'paste'}));
    menu.append(new MenuItem({ label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectall'}));
    menu.append(new MenuItem({label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut'}));
    menu.append(new MenuItem({label: '重新加载', accelerator: 'CmdOrCtrl+R',
        click: function (item, focusedWindow) {
            if (!focusedWindow || !focusedWindow.id) return;
            BrowserWindow.getAllWindows().some(function (win) {
                if (win.id === focusedWindow.id) {
                    focusedWindow.webContents.reload()
                }
            });
        }
    }));
    menu.append(new MenuItem({label: '后退', accelerator: 'CmdOrCtrl+B',
        click: function (item, focusedWindow) {
            if (!focusedWindow || !focusedWindow.id) return;
            BrowserWindow.getAllWindows().some(function (win) {
                if (win.id === focusedWindow.id) {
                    focusedWindow.webContents.goBack();
                }
            });
        }
    }));
    menu.append(new MenuItem({label: '前进', accelerator: 'CmdOrCtrl+F',
        click: function (item, focusedWindow) {
            if (!focusedWindow || !focusedWindow.id) return;
            BrowserWindow.getAllWindows().some(function (win) {
                if (win.id === focusedWindow.id) {
                    focusedWindow.webContents.goForward();
                }
            });
        }
    }));
// menu.append(new MenuItem({label:'前进', enabled:false}));
// menu.append(new MenuItem({label:'后退',enabled:false}));
    app.on('browser-window-created', function (event, win) {
        win.webContents.on('context-menu', function (e, params) {
            menu.popup(win, params.x, params.y)
        })
    });
    var ipcMain = electron.ipcMain;
    ipcMain.on('show-context-menu', function (event) {
        var win = BrowserWindow.fromWebContents(event.sender);
        menu.popup(win)
    });
}