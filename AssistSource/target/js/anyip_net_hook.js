
(function () {
    console.log('start insert hook.js');

    $_$.setPlatMsgListener('getContent', function (senderId, jobKey, msg) {
        var text = $_$(msg.dat.filter).text();
        $_$.rspIpc(senderId, jobKey, 1, {text:text});
    });

    console.log('insert hook.js finish!');
})();

