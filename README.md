# ElectronWebAssit
electron 爬虫 工具 助手 网站

欢迎加入QQ群：112458585 ElectronWeb 交流

ElectronWebAssit 是一个简单浏览器，可以简单实现在不同网页之间互相控制，可以做一些爬虫、主控器之类的工具。
基础功能都打包在 $_$ 中，包含 jquery 和 附加的网页之间通讯的代码。


# electron环境搭建

1> 安装 nodejs

2> 建议安装 cnpm

    npm i cnpm -g
    
    
3> 安装 electron

    cnpm i electron -g
    
4> 使用electron运行 _main.js


5> 在target 中增加你需要控制的网站对象


6> 在target\\js 中实现你想要的一切功能


# 注意事项


1》程序运行后会自动加载 target目录下的js文件

2》每个target有一个名字，一个URL正则，符合这个正则的URL会被视为该target对象，加载对应的JS文件

3》before_load.js文件运行于窗口刚创建时，页面未加载

4》*_hook.js 运行于DOM加载完成之时，所以窗口通过JS加载的东西可能并未出来

