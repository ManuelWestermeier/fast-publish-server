const { log } = require("console");
const fs = require("fs")
const path = require("path")
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const inpPath = "code/index.at"
const outPath = "C:\\Users\\Manuel Westermeier\\source\\repos\\cpp-server-script\\cpp-server-script.cpp"
//const outPath = "out/index.cpp"

compile()
//start compiling
function compile() {
    fs.writeFileSync(outPath,
        fs.readFileSync("src/index.cpp", "utf-8") + parseFile(inpPath)
        , "utf-8")
    //run file on compiled
    exec("onCompiled.bat", {}).then(data =>
        log(data.stdout + data.stderr)
    )
    log("compiled")
}

fs.watch(inpPath, "binary", (x, y) => {
    log(path.join(x, y))
    compile();
})

setInterval(() => compile(), 3000)

function parseFile(pathname = "") {

    const dir = path.dirname(pathname)

    return fs.readFileSync(pathname, "utf-8").split("\n").map((line, lineIndex) => {
        //check if the nostrinp part includes @
        if (!line.split("\"").filter((p, i) => i % 2 == 0).join(" ").includes("@")) return line
        //create the out string
        var out = ""
        //parse the paths
        const parts = line.split("\"").map((part, i) => {
            const isStr = (2 % i == 0)
            return { part, isStr }
        })
        //parse the output
        parts.forEach(({ isStr, part }) => {
            //add the string
            if (isStr) {
                out += `"${part}"`
                return
            }
            //path parts
            const parsedParts = part.split("  ").join(" ").split("\t").join(" ").split("\r").join("").split(" ").filter(p => p != "");
            const [fn] = parsedParts;
            //start the logic
            //on init
            if (fn == "@init") {
                out += "int main(int argc, char *argv[]) {"
            }
            //import form file
            else if (fn == "@imp") {
                //get the path
                const impPath = path.join(dir, parsedParts[1].replace("\r", ""));
                if (impPath == pathname) return;
                if (fs.existsSync(impPath))
                    out += parseFile(impPath);
                else log(`error @imp -> ${impPath} <- file dont exists : on line : ${pathname}:${lineIndex + 1}`);
            }
            //add dependencies
            else if (fn == "@add") {
                var dependencies = parsedParts[1].toLowerCase()
                if (dependencies == "http") {
                    out += `\n${fs.readFileSync("src/cpp-httplib/httplib.h")}\n`;
                }
                else log(`error @add -> ${parsedParts[1].toLowerCase()} <- variable dont exists : on line : ${pathname}:${lineIndex + 1}`);
            }
            //add dependencies
            else if (fn == "@module") {
                out += parseFile(`modules/${parsedParts.slice(1, parsedParts.length).join(" ")}/index.at`)
            }
            //create array
            else if (fn == "@array") {
                out += `vector<${parsedParts[3]}> ${parsedParts[1]};`
            }
            //create constant array
            else if (fn == "@const-array") {
                out += `const vector<${parsedParts[3]}> ${parsedParts[1]};`
            }
            //create array
            else if (fn == "@array") {
                out += `vector<${parsedParts[3]}> ${parsedParts[1]};`
            }
            //loop for each
            else if (fn == "@foreach") {
                out += `for (auto ${parsedParts[1]} : ${parsedParts[3]}) {`
            }
            //destructure constant arrays
            else if (fn == "@const-destr") {
                for (let index = 0; index < parsedParts.length - 5; index++) {
                    out += `const ${parsedParts[3]} ${parsedParts[index + 5]} = ${parsedParts[1]}.at(${index});\n`
                }
            }
            //destructure arrays
            else if (fn == "@destr") {
                for (let index = 0; index < parsedParts.length - 5; index++) {
                    out += `${parsedParts[3]} ${parsedParts[index + 5]} = ${parsedParts[1]}.at(${index});\n`
                }
            }
            //create a dictionary
            else if (fn == "@map") {
                out += `map<${parsedParts[3] ?? "string"}, ${parsedParts[5] ?? "string"}> ${parsedParts[1]};`
            }
            //loop for int
            else if (fn == "@loop") {
                out += `for (int ${parsedParts[3] || "index"} = 0; ${parsedParts[3] || "index"} < ${parsedParts[1]}; ${parsedParts[3] || "index"}++) {`
            }
            //create function
            else if (fn == "@fn") {
                const [name, type] = parsedParts[1].split("#")
                out += `${type || "void"} ${name} ${parsedParts.slice(2, parsedParts.length).join(" ")}`
            }
            //create template strings
            else if (fn == "@templ") {
                const impPath = path.join(dir, parsedParts[3].replace("\r", ""));
                if (impPath == pathname) return;
                if (!fs.existsSync(impPath)) throw new Error("path not exists");
                const template = createTemplate(impPath, parsedParts);
                out += template;
            }
            //class-public
            else if (fn == "@public") {
                out += "public:"
            }
            //class-private
            else if (fn == "@private") {
                out += "private:"
            }
            //comment
            else if (fn[0] == "/" && ((fn[1] == "/")) || (fn[1] == "*")) out += parsedParts.join(" ");
            //return default
            else {
                log(`error identifyier -> ${fn} <- dont exists : on line : ${pathname}:${lineIndex + 1}`);
                out += parsedParts.join(" ");
            }
        })
        //
        return out
    }).join("\n")

}

function createTemplate(pathname, parsedParts) {
    const data = fs.readFileSync(pathname, "utf-8");
    var isVar = true;
    return `string ${parsedParts[1]} = ${data.split("##").map((part, i) => {
        isVar = !isVar;
        if (isVar) {
            return part == "hash" ? '"#"' : part
        }
        else {
            return `"${part.split('"').join('\\"').split("\n").join('\\n').split("\r").join('')}"`
        }
    }).join(" + ")};`
}

process.on("uncaughtException", log)