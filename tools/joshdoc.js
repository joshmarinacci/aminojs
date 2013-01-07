/*
load js file
look for @overview
copy everything after that into a master overview util @end

look for classes
    copy everything after @class to @end into a string
look for properties
look for functions

render everything out into a single doc by nested loops

*/

var fs = require('fs');


fs.readFile('dist/amino.js', function(err,data) {
        //var docs = parseData2(data);
        var docs = parseData3(data);
        generateHTML(docs);
});

function escape(str) {
    str = str.replace(/</gm,"&lt;");
    str = str.replace(/>/gm,"&gt;");
    return str;
}

function w(s) {
    console.log(s);
}

/*
parser design
parse line by line
if line starts with / * then inside comment
if line ends with * / then outside comment
if line starts with // then oneline comment
if line starts with @ then it's a special line
if line starts with @class then inside class. grab name right after. start class
if line starts with @end then finishing class
if line starts with @property then do one line property
if line starts with @funciton then do one line function
if line starts with @overview then doing an overview

*/

function Parser() {
    this.incode = false;
    this.inpara = false;
    this.insideoverview = false;
    this.insideclass = false;
    this.currentClass = null;
    
    this.startCode = function() {
        this.incode = true;
        if(this.insideclass) {
            this.currentClass.description += "<pre><code>";
            return;
        }
        if(this.insideoverview) {
            this.docs.overview += "<pre><code>";
        }
    };
    
    this.endCode = function() {
        this.incode = false;
        if(this.insideclass) {
            this.currentClass.description += "</code></pre>\n";
            return;
        }
        if(this.insideoverview) {
            this.docs.overview += "</code></pre>\n";
        }
    };
    
    this.append = function(line) {
        var str = "";
        
        if(this.incode) {
            str =  escape(line+"\n");
        } else {
            str = (line+"\n");
        }
        
        if(this.insideclass) {
            this.currentClass.description += str;
        }
        if(this.insideoverview) {
            this.docs.overview += str;
        }
        
    }
    
    this.startPara = function() {
        this.docs.overview += "<p>\n";
        this.inpara = true;
    }
    
    this.endPara = function() {
        this.docs.overview += "</p>\n";
        this.inpara = false;
    }
    
    this.isBlank = function(line) {
        return /^\s*$/.test(line);
    }
    
    this.isIndented = function(line) {
        return /^\s\s\s\s+/.test(line);
    }

        
    return this;
};

function parseData3(data) {
    var docs = {
        classes:[],
        overview:""
    };
    data = data.toString();
    
    var lines = data.split("\n");
    var insidecomment = false;
    
    var p = new Parser();
    p.docs = docs;
    
    for(var i=0; i<lines.length; i++) {
        var line = lines[i];
        var insideonlinecomment = false;
        
        //start a multiline comment
        if(/^\s*\/\*/.test(line)) {
            //w("starting a comment");
            insidecomment = true;
        }
        if(/\*\//.test(line)) {
            //w("ending a comment");
            insidecomment = false;
        }
        if(/^\s*\/\//.test(line)) {
            insideonelinecomment = true;
        }
        
        if(!insidecomment && !insideonelinecomment) continue;
        
        if(/^\@overview/.test(line)) {
            p.insideoverview = true;
            p.docs.overviewName = (/\@overview\s*(.*)$/.exec(line))[1];
            continue;
        }
        
        //end an overview or class
        if(/^\@end/.test(line)) {
            if(p.incode) {
                p.endCode();
            }
            p.insideoverview = false;
            p.insideclass = false;
        }
        
        //start a class
        if(/^\@class/.test(line)) {
            p.insideclass = true;
            var r = /@class\s*(\w+)\s*(.*)/;
            var r2 = r.exec(line);
            p.currentClass = {
                name:r2[1],
                description:"",
                functions:[], 
                properties:[],
            };
            docs.classes.push(p.currentClass);
            continue;
        }
        
        //category
        if(/^#category/.test(line)) {
            var category = /#category\s*(\w+)/m.exec(line);
            p.currentClass.category = category[1];
            continue;
        }
        
        //property
        if(/.*\@property/.test(line)) {
            var r1 = /property\s*(\w+)\s*(.*)/.exec(line);
            var prop = { name: r1[1], description: r1[2]};
            p.currentClass.properties.push(prop);
        }
        
        if(/.*\@function/.test(line)) {
            var r2 = /@function\s*(\w+)\s*(\(\S*\))*\s*(.*)/m.exec(line);
            //var r =  /@function\s*(\w+)\s*(\(\S*\))*\s*(.*)/m;
            var fun = { name: r2[1], args:r2[2], description: r2[3]};
            p.currentClass.functions.push(fun);
        }
            
        if(p.insideclass || p.insideoverview) {
            //if blank line
            if(p.isBlank(line)) {
                if(p.inpara) {
                    p.endPara();
                }
            } else {
                
                //if 4 spaces then text, we are in a pre
                if(p.isIndented(line)) {
                    //w("pre: " + line);
                    if(!p.incode) {
                        p.startCode();
                    }
                } else {
                    if(p.incode) {
                        p.endCode();
                    }
                    if(!p.inpara) {
                        p.startPara();
                    }
                }
            }
            p.append(line);
        }
    }
    
    return docs;
}

function parseData2(data) {
    var docs = {classes:[]};
    data = data.toString();
    var regex = /@(\w+)/mg;
    
    var currentClass = null;
    
    while(true) {
        var res = regex.exec(data);
        if(res == null) break;
        
        if(res[1] == "overview") {
            var end = regex.exec(data);
            docs.overview = escape(data.substring(res.index,end.index));
        }
        
        if(res[1] == "class") {
            var end = regex.exec(data);
            var cls = data.substring(res.index,end.index);
            
            var r = /@class\s*(\w+)\s*(.*)/m;
            var r2 = r.exec(cls);
            currentClass = {
                name:r2[1],
                description:cls, 
                functions:[], 
                properties:[],
            };
            var category = /#category\s*(\w+)/m.exec(cls);
            if(category) {
                currentClass.category = category[1];
            }

            docs.classes.push(currentClass);
        }
        
        if(res[1] == "function") {
            //var r = /@function\s*(\w+)\s*(.*)/gm;
            //var r = /@function  \s*  (\w+)  \s* (\(\S*\))  *\s*(.*)/m;
            var r = /@function\s*(\w+)\s*(\(\S*\))*\s*(.*)/m;
            r.lastIndex = res.index;
            var r2 = r.exec(data);
            var fun = { name: r2[1], args:r2[2], description: r2[3]};
            currentClass.functions.push(fun);
        }
        
        if(res[1] == "property") {
            var r = /@property\s*(\w+)\s*(.*)/gm;
            r.lastIndex = res.index;
            var r2 = r.exec(data);
            var fun = { name: r2[1], description: r2[2]};
            currentClass.properties.push(fun);
        }
        
    }
    return docs;
}



var docs = {
    overview: "nothing",
    classes:[
        {
            name:"Amino",
            description: "amino description",
        },
        {
            name:"Amino2",
            description: "amino description",
        },
    ]
}



function generateHTML(docs) {
    w("<html>");
    w("<head><link rel='stylesheet' href='style.css'></link></head>");
    w("<body>");
   
    var cats = {};
    
    docs.classes.forEach(function(cls) {
        if(cls.category) {
            if(!cats[cls.category]) {
                cats[cls.category] = [];
            }
            cats[cls.category].push(cls);
        }
    });
    
    w("<ul id='nav'>");
    for(var cat in cats) {
        w("<li>");
        w("<p>"+cat+"</p>");
        w("<ul>");
        
        cats[cat].forEach(function(cls) {
            w("<li><a href='#"+cls.name+"'>"+cls.name+"</a></li>");
            cls.rendered = true;
        });
        w("</ul>");
        w("</li>");
    }
    
    for(var n in docs.classes) {
        var cls = docs.classes[n];
        if(cls.rendered) continue;
        w("<li><a href='#"+cls.name+"'>"+cls.name+"</a></li>");
    }
    w("</ul>");
    
    w("<div id='overview'>");
    w("<h1>"+docs.overviewName+"</h1>");
    w(docs.overview);
    w("</div>");
    
    
    w("<div id='content'>");
    for(var n in docs.classes) {
        
        var cls = docs.classes[n];
        w("<h2><a id='"+cls.name+"'>"+cls.name+"</a></h2>");
        w("<div class='description'>");
        w(cls.description);
        w("</div>");
        
        if(cls.functions.length > 0) {
            w("<h3>functions</h3>");
            w("<ul>");
            for(var f in cls.functions) {
                w("<li>");
                w("<span>");
                w("<b>" + cls.functions[f].name +"</b>");
                if(cls.functions[f].args) {
                    w("<i>" + cls.functions[f].args +"</i>"); 
                }
                w("</span>");
                w(cls.functions[f].description);
                w("</li>");
            }
            w("</ul>");
        }
        
        if(cls.properties.length > 0) {
            w("<h3>properties</h3>");
            w("<ul>");
            for(var f in cls.properties) {
                w("<li>");
                w("<span><b>" + cls.properties[f].name +"</b></span>");
                w(cls.properties[f].description);
                w("</li>");
            }
            w("</ul>");
        }
        
    }
    
    w("</div>");
    
    w("</body></html>");
}
