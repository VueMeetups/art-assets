
// This will find all .psd files and use 7-zip to zip them up, then delete the original
// It will also check to see if there is a PNG preview available and if not create one.

var fs = require('fs-extra');
var path = require('path');
var exec = require('child_process').execSync;
var zip = require('7zip-bin');
var zipExe = zip.path7za;
var psdExe = path.join('.', 'node_modules', 'bin', 'psd');

Array.prototype.remove = function (itemToRemove) {
    this.splice(itemToRemove, 1);
};

/**
 * Removes any files that we don't want to bother checking
 * @param  {array} allFiles array of strings of all files
 * @return {array}          filtered version of passed in array
 */
function removeIgnoredFilesFromList (allFiles) {
    var filesToIgnore = [
        '.git',
        '.gitignore',
        'node_modules',
        'npm-debug.log',
        'package.json',
        'README.md',
        'test.js',
        'zip-all.js'
    ];

    for (var i = allFiles.length - 1; i > -1; i--) {
        var file = allFiles[i];
        for (var j = 0; j < filesToIgnore.length; j++) {
            var ignorable = filesToIgnore[j];
            if (file === ignorable) {
                allFiles.remove(i);
            }
        }
    }

    return allFiles;
}

/**
 * Swaps out the file extension for a new one
 * @param  {string} fullpath The full file path to your file
 * @param  {string} ext      The new extension including period
 * @return {string}          The same path passed in, but with a different extension at the end
 */
function getFullFileNameWithNewExtension (fullpath, ext) {
    var lastDot = fullpath.lastIndexOf('.');
    var newPath = '';
    if (lastDot > 0) {
        // folder/file
        var fullPathWithoutExtension = fullPath.substring(0, lastDot);
        // folder/file.png
        newPath = fullPathWithoutExtension + ext;
    } else {
        newPath = fullpath + ext;
    }
    return newPath;
}

/**
 * Returns the lowercase file extension of the path passed in
 * @param  {string} fullpath path to a file
 * @return {string}          the extension from the file, lowercased
 */
function getLowerCaseFileExtension (fullpath) {
    // '.psd' or '.7z'
    var extension = fullpath.substr(fullpath.lastIndexOf('.') - fullpath.length);
    extension = extension.toLowerCase();
    return extension;
}

/**
 * If you pass in a PSD or 7z file, then this will tell
 * you if there is a PNG preview for it.
 * @param  {string}  fullpath The full folder path up to, including, the file
 * @return {boolean}          If there is a PNG preview or not
 */
function checkForPreviewPNG (fullpath) {
    // '.psd' or '.7z'
    var extension = getLowerCaseFileExtension(fullpath)

    // If the file we are checking is not PSD/7Z,
    // then we don't care if it has a png preview associated with it,
    // so just return true.
    if (extension !== '.psd' && extension !== '.7z') {
        return true;
    } else {
        var pngPreviewPath = getFullFileNameWithNewExtension(fullpath, '.png');
        if (fs.existsSync(pngPreviewPath)) {
            return true;
        } else {
            return false;
        }
    }
}

/**
 * If you pass in a PSD file, then this will tell you if there is a .7Z for it.
 * @param  {string}  fullpath The full folder path up to, including, the file
 * @return {boolean}          If there is a PNG preview or not
 */
function checkForZippedVersion (fullpath) {
    var extension = getLowerCaseFileExtension(fullpath)

    if (extension === '.psd') {
        var zippedPath = getFullFileNameWithNewExtension(fullpath, '.7z');
        if (fs.existsSync(zippedPath)) {
            return true;
        } else {
            return false;
        }
    // If the file isn't a PSD, then we don't care if it has a zip
    // so just return true
    } else {
        return true;
    }
}

/**
 * Recursive function to loop through all files/folders in the repo
 * and create PNG's and 7Z's for all PSD's.
 * @param  {string} folder This is the full folder path for recursive runs
 */
function checkFilesInFolder (folder) {
    folder = folder || '';
    var folderToScan = path.join(folder, '.');

    var allFiles = fs.readdirSync(folderToScan);
    var allFiles = removeIgnoredFilesFromList(allFiles);

    for (var i = 0; i < allFiles.length; i++) {
        var file = allFiles[i];
        var fullpath = path.join(folder, file);
        var stats = fs.statSync(fullpath);
        var isFolder = stats.isDirectory();
        var isFile = stats.isFile();

        if (isFile && !isFolder) {
            var hasPreview = checkForPreviewPNG(fullpath);
            var hasZip = checkForZippedVersion(fullPath);

            if (!hasPreview && fullpath.toLowerCase().endsWith('.psd')) {
                // generate png preview with psd-cli
                // -c = convert psd to png
                exec(psdExe + ' "' + fullpath + '" -c');
            } else if (!hasPreview && fullpath.toLowerCase().endsWith('.7z')) {
                console.log('Your 7-Zip file does not have a preview png associated with it.');
                console.log(fullpath);
            }

            if (!hasZip && fullpath.toLowerCase().endsWith('.psd')) {
                // a     = create archive
                // -bd   = do not display a progress bar in the CLI
                // -tzip = create a zip formatted file
                // -mx=9 = use maximum compression
                // -y    = auto answer yes to all prompts
                var zipFile = getFullFileNameWithNewExtension(fullpath);
                exec(zipExe + ' a -tzip -mx=9 -y "' + zipFile + '" "' + fullpath + '"');
                fs.removeSync(fullpath);
            }
        } else if (isFolder && !isFile) {
            checkFilesInFolder(fullpath);
        }
    }
}
