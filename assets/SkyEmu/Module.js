var Module = new class NengeModule{
    //noInitialRun = true;
    arguments = ["-v", "--menu"];
    preRun = [];
    postRun = [];
    print(text){
        console.log(text)
    }
    printErr(text){
        console.log(text)
    }
    totalDependencies =  0;
    functionmonitorRunDependencies(left) {
        this.totalDependencies = Math.max(this.totalDependencies, left);
    }
    constructor(T,elm){
        let I = T.I,M=this;
        T.DB_NAME = 'Skyemu';
        T.LibStore = 'data-libjs';
        T.DB_STORE_MAP = {
            'rooms': {},
            //'info': {},
            'userdata': { 'timestamp': false },
            'data-libjs': {},
        };
        I.defines(M, { T, I }, 1);
        M.JSpath = T.JSpath.split('/').slice(0, -2).join('/') + '/SkyEmu/';
        M.version = 1;
        M.runaction = T.runaction;
        M.getLang = T.getLang;
        M.db = {
            userdata:T.getStore('userdata'),
            rooms:T.getStore('rooms'),
            libjs:T.getStore('data-libjs'),
            "/offline":T.getStore('userdata'),
        };
        if(elm){
            if(elm.JSpath)M.JSpath = elm.JSpath;
            elm.innerHTML = `<div class="skyemu"><div class="menu"><div class="menubtn"><span class="menu-icon"></span></div><div class="title"></div><div class="downbtn"><span class="menu-icon"></span></div><ul class="menu-list"></ul></div><div class="container"><canvas tabindex="-1"></canvas></div></div>`;
            I.defines(elm, {'Module':M}, 1);
        }else{
            I.defines(T, {'Module':M}, 1);
        }
        M.emuElm = Nttr(T.$('.skyemu',elm));
        if(navigator.standalone){
            M.emuElm.addClass('webapp');
        }
        M.DB = M.db;
        T.docload(async () =>{
            await M.runaction('loadCores');
        });
    }
    $(str){
        return this.emuElm.$(str);
    }
    $$(str){
        return this.emuElm.$$(str);
    }
    Nttr(str){
        return Nttr(this.$(str));
    }
    lang={};
    exit_path = ["/offline/recent_games.txt"];
    action = {
        async loadCores(){
            let M =this,T=M.T;
            M.canvas = M.$('canvas');
            let title = M.$('.title');
            //下载语言包
            if(typeof USERLANG != 'undefined'){
                M.lang = USERLANG[T.language];
            }else{
                M.lang = await T.FetchItem({
                url: M.JSpath + 'language/' + T.language + '.json?t='+T.time,
                'type': 'json',
                'process':e=>{
                    title.innerHTML = `language:${T.language} ${e}`;
                }
                });
            }
            let CacheFile = await T.FetchItem({
                url: M.JSpath + 'SkyEmu.zip', store: 'data-libjs',version: M.version,
                unpack: true,
                process: e => {
                    title.innerHTML = `Skyemu Core:${e}`;
                },
                packtext: M.getLang('unpack'),
                decode:e=>new TextDecoder().decode(e)
            });
            let asmjs = typeof CacheFile['SkyEmu.js'] =='string'?CacheFile['SkyEmu.js']:new TextDecoder().decode(CacheFile['SkyEmu.js']);
            asmjs = M.runaction('replaceJS',[asmjs]);
            M.wasmBinary = CacheFile['SkyEmu.wasm'];
            this.runaction('BuildMenu');
            (new Function('Module',asmjs))(M);
        },
        replaceJS(asmjs){
            return asmjs.replace(
                /Module\["run"\]\s?=\s?run;/,
                `;((m,n)=>{m.FS = FS;m.callMain = callMain;if(!m.HEAP8)m.HEAP8 = HEAP8;m.run=run;})(Module,MEMFS);`

            ).replace(
                /WebAssembly\.instantiate\(binary, info\)/,
                'WebAssembly.instantiate(binary, info).catch(e=>alert(e.message))'
            ).replace(
                /\s*\w+?\.mkdir\("\/offline"\);/,
                'return Module.runaction("install_FS");'
            )
            /*.replace(
                /function\s?UTF8ArrayToString\(.+?\)\s\{/,
                `function UTF8ArrayToString(heap, idx, maxBytesToRead){var endIdx = idx + maxBytesToRead;var endPtr = idx;if (!endIdx)while (heap[endPtr] && !(endPtr >= endIdx))++endPtr;elseendPtr = endIdx;var u8 = heap.subarray(idx, endPtr);if (typeof TextDecoder !== "undefined") {var u8txt = new TextDecoder("utf8").decode(u8),u8arr = new TextEncoder().encode(u8txt);if (Array.from(u8).join(',') != Array.from(u8arr).join(','))u8txt = new TextDecoder("gbk").decode(u8);console.log(u8txt);return u8txt;}`
            )*/
            .replace(
                /\(\)\n?\s*\{\n?\s*var\s?\w+?\s?=\s?document\.getElementById\("fileInput"\);/g,
                '(){return ;'
            ).replace(
                /\(([\$\d\w\s,]+)\)\n?\s*\{\n?\s*var\s?\w+\s?=\s?document\.getElementById\("fileInput"\);/,
                `($1){var ret_path = Module.LocalGame||"";if(ret_path){Module.GameName = ret_path;}var sz = lengthBytesUTF8(ret_path) + 1;var string_on_heap = _malloc(sz);stringToUTF8(ret_path, string_on_heap, sz);Module.LocalGame = "";return string_on_heap;`
            ).replace(
                /FS\.syncfs\(function\s?\(err\)\s?\{\}\)/g,
                ';'
            )
            /*.replace(
                /console\.log\("sokol_audio\.h:\s?sample rate\s?",\s?Module\._saudio_context\.sampleRate\);/,
                'return Module.runaction("InitAudioContext",[sample_rate,num_channels, buffer_size,__saudio_emsc_pull,HEAPF32]);'
            )*/.replace(
                /document\.createElement\("canvas"\)/g,
                'Module.canvas'
            ).replace(
                /document\.getElementById\([\w\_]+\)/g,
                'Module.canvas'
            ).replace(
                'maybeCStringToJsString(target);',
                'maybeCStringToJsString(target);if(target=="#canvas")return Module.canvas;'
            ).replace(
                /(\w+?)\.id\s?=\s?"_sokol_app_input_element";/,
                'Module.app_input_element = $1;$1.classList.add("_sokol_app_input_element");'
            ).replace(
                /document\.getElementById\("_sokol_app_input_element"\)/g,
                'if(Module.app_input_element)Module.app_input_element'
            ).replace(
                /document\.body\.append/g,
                'Module.emuElm.$(".container").append'
            ).replace(
                /var\s?(\w+?)\s?=\s?\w+?\.softFullscreen\s?\?\s?innerWidth\s?:\s?\w+?\.width;/,
                'var optk = Module.canvas.parentNode.getBoundingClientRect();var $1 = optk.width;'
            ).replace(
                /var\s?(\w+?)\s?=\s?\w+?\.softFullscreen\s?\?\s?innerHeight\s?:\s?\w+?\.height;/,
                'var $1 = optk.height;'
            );
        },
        InitAudioContext(sample_rate,num_channels, buffer_size,__saudio_emsc_pull,HEAPF32){
            let M = this,T=M.T;
            if (M._saudio_context){
                if(M._saudio_context.state === "suspended"){
                    M._saudio_context.resume();
                    return 0;
                }
                return 1;
            } 
            M._saudio_node = null;
            M._saudio_context = null;
            M._saudio_context = new AudioContext({
                sampleRate: sample_rate,
                latencyHint: "interactive"
            });
            M._saudio_node = M._saudio_context.createScriptProcessor(buffer_size, 0, num_channels);
            M._saudio_node.onaudioprocess = function pump_audio(event) {
                var num_frames = event.outputBuffer.length;
                var ptr = __saudio_emsc_pull(num_frames);
                if (ptr) {
                    var num_channels = event.outputBuffer.numberOfChannels;
                    for (var chn = 0; chn < num_channels; chn++) {
                        var chan = event.outputBuffer.getChannelData(chn);
                        for (var i = 0; i < num_frames; i++) {
                            chan[i] = HEAPF32[(ptr >> 2) + (num_channels * i + chn)]
                        }
                    }
                }
            };
            M._saudio_node.connect(M._saudio_context.destination);
            M._saudio_context.resume();
            if (M._saudio_context.state === "suspended") {
                T.on(document,'pointerdown',e=>{
                    console.log('ok');
                    M._saudio_context.resume();
                });
                return 0
            }
            return 1;
        },
        DiskReadyOut(){
            let M = this;
            M.ccall("se_load_settings");
            M.$('.title').innerHTML = '';
            if(M.StartEMU){
                M.StartEMU();
            }else{
                let last = localStorage.getItem('skyemu-lastgame');
                if(last){
                    M.db.rooms.data(last).then(u8=>{
                        M.runaction('writeRoom',[u8,last]);
                    })
                }
            }

        },
        install_FS(){
            let M = this;
            M.F.replaceWrite();
            M.FS.createPath('/','rooms',!0,!0);
            M.runaction('addMount',["/offline"]);
            M.F.mountReady().then(e=>{
            });
        },
        addMount(path) {
            let FS = this.FS;
            if (!FS.analyzePath(path).exists) {
                FS.createPath('/', path, !0, !0);
            }
            FS.mount(this.F, {}, path);
        },
        BuildMenu(){
            let M=this,T=M.T,list = {
                "importSave":"import a sav",
                "importStatus":"import status on slot0",
                "importRoom":"import a room",
                "showData":"View My Rooms",
                "ShowFS":"View FileSystem",
                "miniWin":"Mini Window",
                "importBios":"import a bios",
                "reloadPage":"refreash",
            },html="";
            html+='<li><a href="inline.html" target="_blank">inline run</a></li><li><a href="https://github.com/skylersaleh/SkyEmu" target="_blank">Github:skylersaleh/skyemu</a></li>';
            T.I.toArr(list,entry=>{
                html+=`<li><button type="button" data-act="${entry[0]}">${M.getLang(entry[1])}</button></li>`;
            });
            let MenuBtn = M.Nttr('.menubtn');
            M.Nttr('.menu-list').html(html).click(e=>{
                if(e.target instanceof Element){
                    let act = T.attr(e.target,'data-act');
                    if(act){
                        //MenuBtn.active = false;
                        M.runaction(act,[e.target]);
                    }
                }
            });
            MenuBtn.click(e=>{
                if(this.emuElm.active) return this.emuElm.active = false;
                T.stopEvent(e);
                M.runaction('hideMenu',[!MenuBtn.active]);
            });
            MenuBtn.on('touchstart',e=>T.stopEvent(e));
            MenuBtn.on('touchend',e=>T.stopEvent(e));
            M.Nttr('.downbtn').click(e=>{
                if(!M.FS || !M.GameName)return;
                let path = "/offline/"+M.GameTitle+'.sav';
                if(M.FS.analyzePath(path).exists){
                    let u8 = M.FS.readFile(path);
                    if(u8&&u8 instanceof Uint8Array)T.down(M.GameTitle+'.sav',u8);
                }
            });
        },
        reloadPage(){
            location.reload();
        },
        hideMenu(active){
            let M=this,T=M.T,MenuBtn = M.Nttr('.menubtn'),menulist= M.Nttr('.menu-list');
            MenuBtn.active = active;
            menulist.children.forEach(li=>li.classList.remove('active'));
        },
        async showData(elm){
            let M=this,T=M.T,li = elm.parentNode;
            M.runaction('hideMenu',[false]);
            let ul = T.$('ul',li);
            if(!ul){
                ul = T.$ct('ul',M.getLang('wait...'));
                li.appendChild(ul);
            }else{
                ul.innerHTML = M.getLang('wait...');
            }
            M.db.rooms.keys().then(list=>{
                let html = "";
                list.forEach(v=>{
                    html+=`<li><button data-act="RunRoom" data-key="${v}">${v}</button></li>`;
                });
                ul.innerHTML = html;
            });
            li.classList.add('active');
        },
        async ShowFS(elm){
            let M=this,T=M.T,li = elm.parentNode;
            M.runaction('hideMenu',[false]);
            let ul = T.$('ul',li);
            if(!ul){
                ul = T.$ct('ul',M.getLang('wait...'));
                li.appendChild(ul);
            }else{
                ul.innerHTML = M.getLang('wait...');
            }
            let html='<li><h3>/offline/</h3></li><li><button type="button" data-act="SeleteFSitem" data-key="/">...</button></li>';
            html+=M.runaction('PathToHtml',['/offline/','/offline/']);
            ul.innerHTML = html;
            li.classList.add('active');
        },
        SeleteFSitem(elm){
            let M=this,T=M.T,key=T.attr(elm,'data-key');
            if(M.FS.analyzePath(key).exists){
                let mode = M.FS.stat(key).mode;
                if(M.FS.isFile(mode)){
                    T.down(T.F.getname(key),M.FS.readFile(key));
                }else if(M.FS.isDir(mode)){
                    let ppath=key.replace(/\/$/,'').split('/').slice(0,-1).join('/')+'/',html = `<li><h3>${key||"ROOT/"}</h3></li><li><button type="button" data-act="SeleteFSitem" data-key="${ppath||"/"}">...</button></li>`,ul = elm.parentNode.parentNode;
                    html+=M.runaction('PathToHtml',[key,ppath]);
                    ul.innerHTML = html;
                }
            }
        },
        PathToHtml(key,root){
            let M=this,T=M.T,html="";
            T.I.toArr(M.F.getLocalList(key,!0),entry=>{
                let p = entry[1].dir?'button':'p';
                html +=  `<li><${p} data-act="SeleteFSitem" data-key="${entry[0]}">${entry[0].replace(root,'')}</${p}><p>${entry[1].timestamp.toLocaleString()}</p></li>`;
            });
            return html;
        },
        importRoom(){
            let M=this,T=M.T;
            M.runaction('hideMenu',[false]);
            this.upload(files=>{
                Array.from(files).forEach(async file=>{
                    let u8 = new Uint8Array(await file.arrayBuffer()),filename = file.name;
                    await M.runaction('writeRoom',[await T.unFile(u8),filename]);
                });
            });
        },
        importSave(){
            let M=this,T=M.T;
            if(!M.GameName)return;
            M.upload(files=>{
                Array.from(files).forEach(async file=>{
                    M.F.MKFILE("/offline/"+M.GameTitle+".sav",new Uint8Array(await file.arrayBuffer()));
                    M.LocalGame = "/rooms/"+M.GameName;
                });
            },1);
        },
        importBios(){
            let M=this,T=M.T;
            M.upload(files=>{
                Array.from(files).forEach(async file=>{
                    M.F.MKFILE("/offline/"+M.GameTitle+".sav",new Uint8Array(await file.arrayBuffer()));
                });
            },1);
        },
        importStatus(){
            let M=this,T=M.T;
            if(!M.GameName)return;
            M.upload(files=>{
                Array.from(files).forEach(async file=>{
                    M.F.MKFILE("/offline/"+M.GameTitle+".slot0.state.png",new Uint8Array(await file.arrayBuffer()));
                });
            },1);
        },
        async RunRoom(elm){
            let M=this,T=M.T;
            let key = T.attr(elm,'data-key');
            localStorage.setItem('skyemu-lastgame',key);
            let u8 = await M.db.rooms.data(key);
            if(u8){
                M.runaction('writeRoom',[u8,key,!0]);
            }
            M.runaction('hideMenu',[false]);
        },
        miniWin(){
            this.emuElm.active = true;
        },
        
        writeRoom(u8,filename,bool){
            let M=this,T=M.T;
            if(u8 instanceof Uint8Array){
                M.F.MKFILE('/rooms/'+filename,u8);
                M.LocalGame = '/rooms/'+filename;
                if(!bool){
                    localStorage.setItem('skyemu-lastgame',filename);
                    M.db.rooms.setData(filename,u8,{
                    type:'Uint8Array'
                });}
            }else if(u8){
                let block = false;
                T.I.toArr(u8,
                    async entry=>{
                        M.F.MKFILE('/rooms/'+entry[0],entry[1]);
                        if(/\_\_MACOSX\//.test(entry[0])) return;
                        if(/\.(gba|gb|gbc)$/.test(entry[0])){
                            if(!block){
                                block = true;
                                M.LocalGame = '/rooms/'+entry[0];
                                if(!bool)localStorage.setItem('skyemu-lastgame',entry[0]);
                            }
                        }
                        if(!bool)M.db.rooms.setData(entry[0],entry[1],{
                            type:'Uint8Array'
                        });
                    }
                );
            }
        }

    };
    get GameName(){
        return this.GameFullName;
    }
    set GameName(name){
        name = this.T.F.getname(name);
        this.GameFullName = name;
        this.GameTitle = name.replace(/\.(gba|gb|gbc)/i,'');
        this.$('.title').innerHTML = name;
    }
    F = new class NengeDisk {
        constructor(Module) {
            if (!this.I) this.__autoSet();
            let D = this, T = D.T, I = T.I;
            I.defines(this, {Module}, 1);
            D.speed = T.speed;
            D.runaction = T.runaction;
        }
        action = {};
        __autoSet() {
            let T = Nenge, I = T.I;
            I.defines(this, { T, I }, 1);
        }
        replaceWrite(){
            let D = this;
            D.MEMFS.stream_ops.write = D.ops_write;
            if (D.MEMFS.ops_table) D.MEMFS.ops_table.file.stream.write = D.ops_write;
        }
        get DB (){
            return this.Module.db;
        }
        get FS(){
            return this.Module.FS;
        }
        get MEMFS(){
            return this.Module.FS.filesystems.MEMFS;
        }
        get HEAP8(){
            return this.Module.HEAP8;
        }
        getStore(mount) {
            let M=this,T=M.T,DB = this.DB,path = mount.mountpoint || mount;
            if (!DB[path]) {
                DB[path] = T.getStore(path);
            }
            return DB[path];
        }
        myMount = [];
        mount(mount) {
            let D = this;
            if (!D.FS.analyzePath(mount.mountpoint).exists) {
                D.FS.createPath('/', mount.mountpoint, !0, !0);
            }
            let len = mount.mountpoint.split('/').length;
            let node = D.MEMFS.createNode(len < 3 ? D.FS.root : null, len < 3 ? mount.mountpoint.split('/').pop() : mount.mountpoint.replace(/^\//, ''), 16384 | 511, 0);
            if (D.getStore(mount)) {
                if (!D.__mount) D.__mount = [];
                D.__mount.push(D.syncfs(mount, txt => D.Module.runaction('DiskReadyOut', [txt])));
            }
            this.myMount.push(mount);
            return node;
        }
        mountReady() {
            return Promise.all(this.__mount || []);
        }
        async syncMount(){
            let D = this;
            if(D._syncMount) return;
            D._syncMount = true;
            await Promise.all(D.myMount.map(async v=>{
                D.syncfs(v,e=>console.log(e))}
            ));
            D._syncMount = false;
            console.log('indexDB updata!');
        }
        async syncfs(mount, callback, error) {
            let D = this,noback = callback;
            //console.log(callback, error);
            callback = error instanceof Function ? error : callback;
            let store = D.getStore(mount);
            let result;
            if (!mount.isReady) {
                result = await D.writeToFS(store);
            } else {
                result = await D.syncWrite(store, mount);
            }
            mount.isReady = true;
            if(!noback){
                return callback&&callback();
            }
            (callback instanceof Function) && callback(noback?result:undefined);
            return result;
        }
        async writeToFS(store) {
            let D = this, I = D.I;
            return I.toArr(await store.all(true)).map(entry => D.storeLocalEntry(entry[0], entry[1])).join("\n");
        }
        async syncWrite(store, mount) {
            let D = this, I = D.I,
                IsReady = mount.isReady,
                local = D.getLocalSet(mount),
                remote = await D.getRemoteSet(store),
                src = (IsReady ? local : remote).entries || {},
                dst = (!IsReady ? local : remote).entries || {};
            let result = await Promise.all(I.toArr(src).filter(entry => {
                if (!entry[1]) return '';
                let path = entry[0],
                    e2 = dst[path];
                if (!e2 || entry[1].timestamp > e2.timestamp) {
                    return true;
                }
                return false;
    
            }).map(entry => entry[0]).sort().map(async path => {
                if (!IsReady) {
                    let contents = await store.get(path);
                    if (contents) {
                        return D.storeLocalEntry(path, contents);
                    }
                } else {
                    let contents = D.loadLocalEntry(path);
                    if (contents) {
                        await store.put(path, contents);
                        return 'DB saved:' + path;
                    }
                }
            }));
            result.concat(await Promise.all(I.toArr(dst).filter(entry => {
                if (!entry[1]) return '';
                let e2 = src[entry[0]],
                    path = entry[0];
                if (!e2 || entry[1].timestamp > e2.timestamp) {
                    return true;
                }
                return false;
    
            }).map(entry => entry[0]).sort().map(async path => {
                let msg = '';
                if (!IsReady) {
                    D.removeLocalEntry(path);
                    msg = 'FS remove:';
                } else {
                    await store.remove(path);
                    msg = 'DB remove:';
                }
                return msg + entry[0];
            })));
            D.Module.runaction('indexdb-sync', [IsReady, result]);
            return result.join("\n");
        }
        loadLocalEntry(path) {
            let D = this, FS = D.FS,
                stat, node,Module = D.Module;
                if(Module.exit_path&&Module.exit_path.includes(path))return;
            if (FS.analyzePath(path).exists) {
                var lookup = FS.lookupPath(path);
                node = lookup.node;
                stat = FS.stat(path)
            } else {
                return path + ' is exists'
            }
            if (FS.isDir(stat.mode)) {
                return {
                    timestamp: stat.mtime,
                    mode: stat.mode
                };
            } else if (FS.isFile(stat.mode)) {
                node.contents = D.getFileDataAsTypedArray(node);
                return {
                    timestamp: stat.mtime,
                    mode: stat.mode,
                    contents: node.contents
                };
            } else {
                return "node type not supported";
            }
        }
        storeLocalEntry(path, entry) {
            let D = this, T = D.T, FS = D.FS,Module = D.Module;
            if(Module.exit_path&&Module.exit_path.includes(path))return;
            console.log(path);
            if (FS.isDir(entry.mode)) {
                !FS.analyzePath(path).exists && FS.createPath('/', path, !0, !0)
            } else if (FS.isFile(entry.mode)) {
                let p = path && path.split('/').slice(0, -1).join('/');
                if (p && !FS.analyzePath(p).exists) FS.createPath('/', p, !0, !0);
                FS.writeFile(path, entry.contents, {
                    canOwn: true,
                    encoding: "binary"
                });
            } else {
                T.Err("node type not supported");
            }
            FS.chmod(path, entry.mode);
            FS.utime(path, entry.timestamp, entry.timestamp);
            return 'FS write:' + path;
        }
        removeLocalEntry(path) {
            let FS = this.FS;
            if (FS.analyzePath(path).exists) {
                var stat = FS.stat(path);
                if (FS.isDir(stat.mode)) {
                    FS.rmdir(path)
                } else if (FS.isFile(stat.mode)) {
                    FS.unlink(path)
                }
                return 'FS unlink:' + path;
            } else {
                return path + 'is not exists';
            }
        }
        async getRemoteSet(store, callback) {
            let remote = {
                'type': "remote",
                store,
                entries: await store.cursor('timestamp', true)
            };
            callback && callback(remote);
            return remote;
        }
        getLocalSet(mount, callback) {
            let D = this, T = D.T;
            if (!mount) T.Err('mount:PATH ERROR');
            let result = {
                "type": "local",
                entries: D.getLocalList(mount.mountpoint)
            };
            callback && callback(result);
            return result
        }
        getLocalList(mountpoint,bool) {
            mountpoint = mountpoint || '/';
            let D = this, T = D.T, FS = D.FS,
                entries = {},
                filterRoot = [".", ".."].concat(mountpoint == '/' ? ["dev", "tmp", "proc"] : []),
                isRealDir = p => !filterRoot.includes(p),
                toAbsolute = root => p => D.join2(root, p),
                check = D.stat(mountpoint) && FS.readdir(mountpoint).filter(isRealDir).map(toAbsolute(mountpoint));
            if (!check) T.Err('mount:PATH ERROR');
            while (check.length) {
                let path = check.pop();
                let stat = D.stat(path);
                if (stat) {
                    entries[path] = {
                        timestamp: stat.mtime
                    }
                    if (FS.isDir(stat.mode)) {
                        if(!bool)check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
                        entries[path]['dir'] = true;
                    }
    
                }
            }
            return entries;
        }
        stat(path) {
            let D = this, FS = D.FS, pathinfo = FS.analyzePath(path);
            if (pathinfo.exists && pathinfo.object.node_ops && pathinfo.object.node_ops.getattr) {
                return FS.stat(path);
            }
        }
        getFileDataAsTypedArray(node) {
            if (!node.contents) return new Uint8Array;
            if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
            return new Uint8Array(node.contents)
        }
        join() {
            var paths = Array.prototype.slice.call(arguments, 0);
            return this.normalize(paths.join("/"))
        }
    
        join2(l, r) {
            return this.normalize(l + "/" + r)
        }
        normalize(path) {
            var isAbsolute = path.charAt(0) === "/",
                trailingSlash = path.substring(-1) === "/";
            path = this.normalizeArray(path.split("/").filter(p => {
                return !!p
            }), !isAbsolute).join("/");
            if (!path && !isAbsolute) {
                path = "."
            }
            if (path && trailingSlash) {
                path += "/"
            }
            return (isAbsolute ? "/" : "") + path
        }
    
        normalizeArray(parts, allowAboveRoot) {
            var up = 0;
            for (var i = parts.length - 1; i >= 0; i--) {
                var last = parts[i];
                if (last === ".") {
                    parts.splice(i, 1)
                } else if (last === "..") {
                    parts.splice(i, 1);
                    up++
                } else if (up) {
                    parts.splice(i, 1);
                    up--
                }
            }
            if (allowAboveRoot) {
                for (; up; up--) {
                    parts.unshift("..")
                }
            }
            return parts
        }
        ops_write = (stream, buffer, offset, length, position, canOwn) => {
            let D = this;
            if (D.HEAP8 && buffer.buffer === D.HEAP8.buffer) {
                canOwn = false
            }
            if (!length) return 0;
            var node = stream.node;
            node.timestamp = Date.now();
            if (buffer.subarray && (!node.contents || node.contents.subarray)) {
                if (canOwn) {
                    node.contents = buffer.subarray(offset, offset + length);
                    node.usedBytes = length;
                    return length
                } else if (node.usedBytes === 0 && position === 0) {
                    D.update(stream);
                    node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
                    node.usedBytes = length;
                    return length
                } else if (position + length <= node.usedBytes) {
                    node.contents.set(buffer.subarray(offset, offset + length), position);
                    return length
                }
            }
            D.MEMFS.expandFileStorage(node, position + length);
            if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);
            else {
                for (var i = 0; i < length; i++) {
                    node.contents[position + i] = buffer[offset + i]
                }
            }
            node.usedBytes = Math.max(node.usedBytes, position + length);
            return length
        };
        updatePromise(stream) {
            let D = this;
            return new Promise((resolve, reject) => {
                if (!D.updateList.includes(stream.node.mount)) D.updateList.push(stream.node.mount);
                let Timer = setInterval(() => {
                    if (D.updateTime && Timer != D.updateTime) {
                        clearInterval(Timer);
                        reject('other update');
                    }
                    if (stream.fd == null) {
                        clearInterval(Timer);
                        resolve('ok');
                    }
                }, D.speed);
                D.updateTime = Timer;
            });
        }
        updatePath = [];
        updateList = [];
        async updateMount(result) {
            let D = this;
            if (D.updateList.length) {
                let list = D.updateList.map(async mount => D.syncfs(mount, e => console.log(e,result)));
                D.updateList = [];
                D.updatePath = [];
                await Promise.all(list);
            }
        }
        update(stream) {
            let D = this;
            if (!D.getStore(stream.node.mount)) return;
            if (stream.path && stream.fd != null && !D.updatePath.includes(stream.path)) {
                D.updatePath.push(stream.path)
                D.updatePromise(stream).then(result => D.updateMount(result));
            }
        }
        MKFILE(path, data, bool) {
            let FS = this.FS,
                dir = path.split('/');
            if (dir.length) dir = dir.slice(0, -1).join('/');
            else dir = '/';
            if (!FS.analyzePath(dir).exists) {
                let pdir = dir.split('/').slice(0, -1).join('/');
                if (!FS.analyzePath(pdir).exists) FS.createPath('/', pdir, !0, !0);
                FS.createPath('/', dir, !0, !0);
            }
            if (typeof data == 'string') data = new TextEncoder().encode(data);
            if (bool) {
                if (FS.analyzePath(path).exists) FS.unlink(path);
                FS.writeFile(path, data, {
                    canOwn: true,
                    encoding: "binary"
                });
            } else if (!FS.analyzePath(path).exists) {
                FS.writeFile(path, data, {
                    canOwn: true,
                    encoding: "binary"
                });
            }
        }
    }(this);
    upload(func,bool){
        let input = this.T.$ce('input');
        input.type = 'file';
        if(!bool)input.multiple = true;
        input.onchange = e => {
            let files = e.target.files;
            if (files && files.length > 0) {
                return func(files);
            }
            input.remove();
        };
        input.click();
    }
    async FetchRoom(path,version){
        let M=this,T=M.T;
        let u8 = await T.FetchItem({url:path,store:M.db.rooms,unpack:true}),key=T.F.getname(path);
        localStorage.setItem('skyemu-lastgame',key);
        return M.runaction('writeRoom',[u8,key,!0]);
    }
}(Nenge,typeof thisELM != 'undefined'?thisELM:undefined);