
(function () {console.log('start insert platAjax.js');


    if(!window.hasOwnProperty('$_$')){window.$_$ = window.$ || {};}

    var $_$ = window.$_$;
    $_$.goodLookChars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/

    $_$.DEST_ID = {
        APP:-1,
        ALL_WINDOW:0
    };
    $_$.CMD = {
        RSP:'rsp',
        SET_APP_VAR:'setAppVar',
        GET_APP_VAR:'getAppVar',
        SEND_INPUT:'sendInput',
        OPEN_WINDOW:'openWindow',
        QUERY_WINDOW:'queryWindow',
        AJAX:'ajax',
    };

    $_$.jobs = {};
    $_$.ipcUrl = 'https://plat_ipc/';

    $_$.getCookie = function (name) {
        var arr, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");

        if (arr = document.cookie.match(reg))
            return unescape(arr[2]);
        else
            return null;
    };

    $_$.randomString = function (len) {
        len = len || 32;
        var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
        var maxPos = $chars.length;
        var pwd = '';
        for (var i = 0; i < len; i++) {
            pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd;
    };

    $_$.onSendTimeout = function (jobInfo) {
        if(jobInfo.error){
            jobInfo.error({status:408, message:'timeout'});
        }
        delete $_$.jobs[jobInfo.jobId];
    };

    //
    $_$.setPlatMsgListener = function (cmd, callback){
        if(!$_$.allListener) $_$.dataListener = {};
        if(!cmd){
            return ('必须指定 cmd');
        }
        if(!callback){
            delete $_$.dataListener[cmd];
            return ;
        }
        if($_$.dataListener[cmd]){
            return ('重复监听该命令: ' + cmd);
        }
        if(typeof callback != 'function'){
            return ('传入参数必须是函数');
        }
        $_$.dataListener[cmd] = callback;
    };

    // 跨页面请求，可发送给主进程或者其他主页面。必须有的参数：dstWindowId、cmd
    // 必须指定 dstWindowId, 0表示发送给主进程，其他数值表示窗口
    // 可以通过 QUERY_WINDOW 查询所有的窗口ID。不支持发给所有窗口
    $_$.sendIpc = function (param, onSuc, onError) {
        ['dstWindowId', 'cmd'].forEach(function (name) {
            if(param.hasOwnProperty(name)) return;
            if(onError){onError('必须指定 ' + name)};return;
        });
        if(param.cmd.match(/rsp/i)){if(onError){onError(' rsp 专用于消息响应，不能当做命令使用 ');}return; }

        var jobKey = param.jobKey = $_$.randomString(32);
        var jobInfo = $_$.jobs[jobKey] = {success:onSuc, error:onError};

        $_$.ajax({
            url:$_$.ipcUrl,
            type:'post',
            data: encodeURIComponent(JSON.stringify(param)),
            processData:false
        });


        var timeout = param.timeout;
        if(!timeout || isNaN(timeout)) timeout = 120000;
        if(timeout > 0){
            jobInfo.timeoutId = setTimeout(function (args) {
                $_$.onSendTimeout(jobInfo);
            }, timeout);
        }
    };

    $_$.onIpcMsg = function (senderId, jobKey, param) {

        if(param.cmd == 'rsp'){
            $_$.onIpcRsp(jobKey, param.isSuc, param.rsp);
            return;
        }
        else if(param.cmd == 'ajax'){
            var sendParam = {url:param.url};
            if(param.type){sendParam.type = param.type;}
            if(param.dataType){sendParam.dataType = param.dataType;}
            if(param.data){sendParam.data = param.data;}

            if(param.cookieAddon){
                for(var ck in param.cookieAddon){
                    var pn = param.cookieAddon[ck];
                    var ckVal = getCookie(ck);
                    if(!param.data){param.data = {};}
                    param.data[pn] = ckVal;
                }
            }

            sendParam.success = function (rsp) {
                $_$.rspIpc(senderId, jobKey, 1, rsp);
            };
            sendParam.error = function (rsp) {
                $_$.rspIpc(senderId, jobKey, 0, rsp);
            };
            $.ajax(sendParam);
            return;
        }
        var func = $_$.dataListener[param.cmd];
        if(!func){
            $_$.rspIpc(senderId, jobKey, 0, '未知命令: ' + param.cmd);
            return;
        }
        try{func(senderId, jobKey, param);}catch(e){
            console.log(e);
        }
    };

    //回复Ipc请求
    $_$.rspIpc = function (toId, jobKey, isSuc, rsp) {
        $_$.ajax({
            url:$_$.ipcUrl,
            type:'post',
            data: encodeURIComponent(JSON.stringify({dstWindowId:toId, cmd:'rsp', jobKey:jobKey, isSuc:isSuc, rsp:rsp})),
            processData:false
        });
    };

    $_$.platAjax = function (dstWindowId, param) {
        var onSuc = param.success;
        var onError = param.error;
        delete param.success;
        delete param.error;

        $_$.sendIpc({cmd:'ajax', dstWindowId:dstWindowId, dat:param}, onSuc, onError);
    };


    $_$.onIpcRsp = function (jobKey, isSuc, rspObj) {
        if($_$.jobs[jobKey]){
            var func = isSuc ? $_$.jobs[jobKey].success : $_$.jobs[jobKey].error;
            var jobInfo = $_$.jobs[jobKey];

            if(func){func(rspObj);}
            if(jobInfo.timeoutId){
                clearTimeout(jobInfo.timeoutId);
                delete jobInfo.timeoutId;
            }
            delete $_$.jobs[jobKey];
        }
    };

    $_$.setAppVar = function (keys, dat, cb) {
        var sendParam = {dstWindowId:$_$.DEST_ID.APP, cmd:'setAppVar', keys:keys, dat:dat};
        $_$.sendIpc(sendParam, cb);
    };

    $_$.getAppVar = function (keys, cb) {
        var sendParam = {dstWindowId:$_$.DEST_ID.APP, cmd:'getAppVar', keys:keys};
        $_$.sendIpc(sendParam, cb);
    };

    $_$.enumWindow = function (urlReg, cb) {
        var sendParam = {dstWindowId:$_$.DEST_ID.APP, cmd:'queryWindow', urlReg:urlReg};
        $_$.sendIpc(sendParam, cb);
    };

    $_$.openTargetWindow = function (param, cb) {
        param.dstWindowId = $_$.DEST_ID.APP;
        param.cmd = $_$.CMD.OPEN_WINDOW;
        $_$.sendIpc(param, cb, cb);
    };

    $_$.sendInputEvent = function (dat, cb) {
        $_$.sendIpc({dstWindowId:$_$.DEST_ID.APP, cmd:'sendInput', dat:dat}, cb, cb);
    };

    function delayAndMoveNext(param, cb) {
        var delayTime = 30 + Math.random() * 90;
        var dSec = delayTime / 1000;
        setTimeout(function () {
            if(param.x <= param.destX){
                param.vx = (param.vx + param.ax * dSec);
                param.vy = (param.vy + param.ay * dSec);
            }
            else{
                param.vx = (param.vx - param.stopAx * dSec);
                param.vy = (param.vy - param.stopAy * dSec);
            }
            var moving = false;
            if(param.vx > 0){
                param.x += param.vx;
                moving = true;
            }
            if(param.vy < 0){
                param.y += param.vy;
                moving = true;
            }
            if(!moving){
                cb();
            }
            else{
                $_$.sendInputEvent({type: 'mouseMove', x:parseInt(param.x) , y:parseInt(param.y)});
                delayAndMoveNext(param, cb);
            }
        }, delayTime)
    };
    $_$.dragFromTo = function (ptFrom, lenX, cb) {
        var rightTo = ptFrom.left + lenX;
        var slowX = rightTo + 30 - Math.random() * 60;  // 减速位有偏移
        var maxVx = lenX / (0.3 + Math.random() * 0.7); // 最高速度是0.3 - 1 秒内完成
        var ax = maxVx / (0.2 + Math.random() * 0.3);   // 0.2 - 0.5秒完成加速
        var stopAx = ax * (1.2 + Math.random());        // 减速比加速快一些.
        var ay = (0 - 10) * Math.random();
        var stopAy = ay * (1.2 + Math.random());        //

        var param = {x:ptFrom.left, y:ptFrom.top, destX:rightTo, slowX:slowX,
            vx:0, maxVx:maxVx, ax:ax, stopAx:stopAx,
            vy:0, ay:ay, stopAy:stopAy};

        $_$.sendInputEvent({type: 'mouseDown', x:parseInt(param.x) , y:parseInt(param.y)});
        delayAndMoveNext(param, function () {
            $_$.sendInputEvent({type: 'mouseUp', x:parseInt(param.x) , y:parseInt(param.y)});
            if(cb) setTimeout(cb, Math.random() * 500 + 500);
        });
    };

    $_$.setAutoReload = function(interval, newUrl){
        if($_$.autoReloadTid){
            clearTimeout($_$.autoReloadTid);
            delete $_$.autoReloadTid;
        }
        if(isNaN(interval) || interval < 0){
            return;
        }
        interval = interval || 90000;
        console.log('enable auto reload: ' + interval + ', URL: ' + newUrl);
        $_$.autoReloadTid = setTimeout(
            function () {
                if(newUrl) window.location.href = newUrl;
                else window.location.reload(true);
            },
            interval
        );
    };

    $_$.clickItem = function (element, cb) {
        var ptFrom = $_$(element).offset();
        var width = $_$('#nc_1_wrapper').width();
        var height = $_$('#nc_1_wrapper').width();
        ptFrom.left += Math.random() * 10 - window.pageXOffset + width / 2;
        ptFrom.top += Math.random() * 10 - window.pageYOffset + height / 2;

        $_$.sendInputEvent({type: 'mouseMove', x:parseInt(ptFrom.left) , y:parseInt(ptFrom.top)});
        setTimeout(function () {
            $_$.sendInputEvent({type: 'mouseDown', x:parseInt(ptFrom.left) , y:parseInt(ptFrom.top)});
        }, 100);
        setTimeout(function () {
            $_$.sendInputEvent({type: 'mouseUp', x:parseInt(ptFrom.left) , y:parseInt(ptFrom.top)});
            if(cb) cb();
        }, 200);
    };

    console.log('insert platAjax.js finished!');})();


Date.prototype.format = function(fmt) {
    var o = {
        "M+" : this.getMonth()+1,                 //月份
        "d+" : this.getDate(),                    //日
        "h+" : this.getHours(),                   //小时
        "m+" : this.getMinutes(),                 //分
        "s+" : this.getSeconds(),                 //秒
        "q+" : Math.floor((this.getMonth()+3)/3), //季度
        "S"  : this.getMilliseconds()             //毫秒
    };
    if(/(y+)/.test(fmt)) {
        fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));
    }
    for(var k in o) {
        if(new RegExp("("+ k +")").test(fmt)){
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
        }
    }
    return fmt;
}