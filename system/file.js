/*
    subOS
 
    Copyright (C) Subnodal Technologies. All Rights Reserved.
 
    https://subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

// See /docs/en/system/file.md to learn more about this exposure

const fs = require("fs");
const path = require("path");

const main = require("./main");

// See /backend/enums.js
const accessStatus = {
    ACCESSIBLE: 0,
    UNKNOWN: -1,
    NONEXISTENT: -2,
    NOT_READABLE: -3,
    NOT_WRITABLE: -4,
    NOT_FILE: -5,
    NOT_FOLDER: -6,
    ALREADY_EXISTS: -7
};

function getFilesystemPath(localPath) {
    var filesystemPath = path.join(main.userFs, localPath);

    if (filesystemPath.startsWith(main.userFs)) {
        return filesystemPath;
    }

    return main.userFs; // If path goes back too many times, limit it to the root path
}

function getAccessStatus(localPath, exists = true, read = true, write = false, type = null) {
    try {
        exists && fs.accessSync(getFilesystemPath(localPath), fs.constants.F_OK);
    } catch (e) {
        return accessStatus.NONEXISTENT;
    }

    try {
        read && fs.accessSync(getFilesystemPath(localPath), fs.constants.R_OK);
    } catch (e) {
        return accessStatus.NOT_READABLE;
    }

    try {
        write && fs.accessSync(getFilesystemPath(localPath), fs.constants.W_OK);
    } catch (e) {
        return accessStatus.NOT_WRITABLE;
    }

    if (fs.statSync(getFilesystemPath(localPath)).isDirectory() && type != null && type == "file") {
        return accessStatus.NOT_FILE;
    }

    if (fs.statSync(getFilesystemPath(localPath)).isFile() && type != null && type == "folder") {
        return accessStatus.NOT_FOLDER;
    }

    return accessStatus.ACCESSIBLE;
}

exports.exists = function(path) {
    return Promise.resolve(fs.existsSync(getFilesystemPath(path)));
};

exports.getInfo = function(path) {
    if (getAccessStatus(path, true, true, false, null) != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, true, true, false, null));
    }

    var stats = fs.statSync(getFilesystemPath(path));

    return Promise.resolve({
        type: stats.isDirectory() ? "folder" : "file",
        size: stats.size,
        writable: getAccessStatus(path, true, true, true, null) != accessStatus.NOT_WRITABLE,
        created: stats.birthtime,
        lastRead: stats.atime,
        lastWritten: stats.mtime,
        lastInfoChange: stats.ctime,
    });
};

exports.rename = function(oldPath, newPath) {
    if (getAccessStatus(oldPath, true, true, false, null) != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, true, true, false, null));
    }

    if (fs.existsSync(getFilesystemPath(newPath))) {
        return Promise.reject(accessStatus.ALREADY_EXISTS);
    }

    fs.rename(getFilesystemPath(oldPath), getFilesystemPath(newPath));

    return Promise.resolve();
};

exports.readFolder = function(path) {
    if (getAccessStatus(path, true, true, false, "folder") != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, true, true, false, "folder"));
    }

    return Promise.resolve(fs.readdirSync(getFilesystemPath(path)));
};

exports.createFolder = function(path) {
    if (getAccessStatus(path + "/..", false, true, true, "folder") != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path + "/..", false, true, true, "folder"));
    }

    if (fs.existsSync(getFilesystemPath(path))) {
        return Promise.reject(accessStatus.ALREADY_EXISTS);
    }

    fs.mkdirSync(getFilesystemPath(path), {recursive: true});

    return Promise.resolve();
};

exports.deleteFolder = function(path) {
    if (getAccessStatus(path, true, false, true, "folder") != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, true, false, true, "folder"));
    }

    try {
        fs.rmdirSync(getFilesystemPath(path), {recursive: true});
    } catch (e) {
        return Promise.reject(accessStatus.UNKNOWN);
    }

    return Promise.resolve();
};

exports.readFile = function(path) {
    if (getAccessStatus(path, true, true, false, "file") != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, true, true, false, "file"));
    }

    return Promise.resolve(fs.readFileSync(getFilesystemPath(path), "utf8"));
};

exports.readFileBinary = function(path, start, size) {
    if (getAccessStatus(path, true, true, false, "file") != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, true, true, false, "file"));
    }

    var stream = fs.createReadStream(getFilesystemPath(path), {start, end: start + size});
    var buffer = new Buffer.alloc(size);
    var bufferPointer = 0;

    return new Promise(function(resolve, reject) {
        stream.on("data", function(chunk) {
            for (var i = 0; i < chunk.length; i++) {
                buffer[bufferPointer] = chunk[i];
    
                bufferPointer++;
            }
        });

        stream.on("end", function() {
            resolve(buffer);
        });
    });
};

exports.writeFile = function(path, data, append = false) {
    if (fs.existsSync(getFilesystemPath) && getAccessStatus(path, false, true, "file") != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, false, true, "file"));
    }

    if (append) {
        fs.appendFileSync(getFilesystemPath(path), data);
    } else {
        fs.writeFileSync(getFilesystemPath(path), data);
    }

    return Promise.resolve();
};

exports.writeFileBinary = function(path, data, append = false) {
    return exports.writeFile(path, data, append); // `fs.writeFileSync` and `fs.appendFileSync` also accept buffers
};

exports.deleteFile = function(path) {
    if (getAccessStatus(path, true, false, true, "file") != accessStatus.ACCESSIBLE) {
        return Promise.reject(getAccessStatus(path, true, false, true, "file"));
    }

    return exports.unlinkSync(getFilesystemPath(path));
};