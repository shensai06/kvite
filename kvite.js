/** @format */

const Koa = require("koa");
const app = new Koa();

const opn = require("opn"); //目标通常想打开的文件、url或者可执行的文件，一般会用系统中默认的应用打开，当然也可以指定应用以及相关的开启参数
const fs = require("fs"); // 文件系统
const path = require("path");
const complierSFC = require("@vue/compiler-sfc"); //引入vue文件的解析 预编译为标准的 JavaScript 与 CSS
const complierDOM = require("@vue/compiler-dom"); //引入template的解析

// 中间件配置
// 处理路由
app.use(async (ctx) => {
  const { url, query } = ctx.request;

  // 1、处理首页请求  一般是 html
  if (url === "/") {
    //加载index.html
    ctx.type = "text/html";
    ctx.body = fs.readFileSync(path.join(__dirname, "./index.html"), "utf8");
    return;
  }
  // 2、js文件加载处理 类似 mainjs

  if (url.endsWith(".js")) {
    const p = path.join(__dirname, url);
    ctx.type = "application/javascript";
    ctx.body = rewriteImport(fs.readFileSync(p, "utf8"));
    return;
  }

  // 3、node_modules  包路径更换
  if (url.startsWith("/@modules/")) {
    //裸模块名称
    const moduleName = url.replace("/@modules/", "");
    //去node_modules目录中找
    const prefix = path.join(__dirname, "./node_modules", moduleName);
    //package.json中获取module字段
    const module = require(prefix + "/package.json").module;
    const filePath = path.join(prefix, module);
    // module dist/vue.runtime.esm-bundler.js
    // filePath  /Users/shensai/Desktop/github/kvite/node_modules/vue/dist/vue.runtime.esm-bundler.js
    const ret = fs.readFileSync(filePath, "utf8");
    ctx.type = "application/javascript";
    ctx.body = rewriteImport(ret);
    return;
  }
  // 利用 complierSFC解析 vue 文件
  if (url.indexOf(".vue") > -1) {
    //获取加载文件路径
    const p = path.join(__dirname, url.split("?")[0]);
    const ret = complierSFC.parse(fs.readFileSync(p, "utf8")); // console.log(ret)  可以看到是一颗ast树，可以在终端中查看
    // vue文件后缀会携带 参数 type=template   为空则为 js，template则是 html
    if (!query.type) {
      //SFC请求，读取vue文件，解析为js
      //获取脚本部分的内容
      const scriptContent = ret.descriptor.script.content;
      //替换默认导出为一个常量，方便后续修改
      const script = scriptContent.replace(
        "export default ",
        "const __script = "
      );
      ctx.type = "application/javascript";
      // 解析template
      ctx.body = `
        ${rewriteImport(script)}
        import {render as __render} from '${url}?type=template'
        __script.render = __render
        export default __script
        `;
      return;
    }
    // 如果是 html
    if (query.type === "template") {
      const tpl = ret.descriptor.template.content;
      //编译为render
      const render = complierDOM.compile(tpl, {
        mode: "module",
      }).code;
      ctx.type = "application/javascript";
      ctx.body = rewriteImport(render);
    }
  }
});

// 裸模块地址的重写
//在vite中对于vue这种裸模块是无法识别的，它通过预编译把需要的模块打包到node_modules中，再通过相对地址找到并加载，
//这里我们通过识别 /@modules 这种地址标识，去找寻模块，进行地址的替换
//import xx from "vue"  ==> import xx from "/@modules/vue"
function rewriteImport(content) {
  return content.replace(/ from ['"](.*)['"]/g, function (s1, s2) {
    if (s2.startsWith("./") || s2.startsWith("/") || s2.startsWith("../")) {
      return s1;
    } else {
      //裸模块替换
      return ` from '/@modules/${s2}'`;
    }
  });
}

app.listen(3000, () => {
  console.log("kvite start");
  opn(`http://localhost:3000/`);
});
