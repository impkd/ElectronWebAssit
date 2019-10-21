
(function () {
    console.log('start insert hook.js');

    window.getTitleOfAnyipNet = function () {

        $_$.enumWindow("\\.anyip\\.net", function (rsp) {
            console.log(rsp);
            if(rsp && rsp.me && rsp.inst && rsp.inst.length >= 1){

                $_$.sendIpc({
                        dstWindowId:rsp.inst[0].id,
                        cmd:'getContent',
                        dat:{
                            filter:'.logo h1'
                        }
                    },
                    function(rsp){
                        console.log(rsp);
                        alert('查到的信息是："' + rsp.text + '"\n, 程序工作流程请参考：target\\js\\目录中的 *_hook.js文件');
                    }
                );
            }
        });
    };
    if(1){
        $_$('#topimg').append(
            '<div style="text-align: center;">' +
            '<button style="font-size:32px;" onclick="window.getTitleOfAnyipNet(this)">' +
            '查看 anyip.net 的内容<br>代码参考：target\\js\\usdp_net_hook.js' +
            '</button></div>');
    }
    //
    console.log('insert hook.js finish!');
})();

