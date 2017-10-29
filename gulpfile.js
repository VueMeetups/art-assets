
// This will find all .psd files and use 7-zip to zip them up, then delete the original
// It will also check to see if there is a PNG preview available and if not create one.

var gulp = require('gulp');
var fs = require('fs-extra');
var path = require('path');
var exec = require('child_process').execSync;
var zip = require('7zip-bin');
var zipExe = zip.path7za;
var PSD = require('psd');

Array.prototype.remove = function (itemToRemove) {
    this.splice(itemToRemove, 1);
};

/**
 * Force the script to pause for x milliseconds
 * @param  {number} ms Amount of milliseconds to wait
 */
function wait (ms) {
    console.log(ms);
    var now = Date.now();
    var later = now + ms;
    while (Date.now() < later) {
        // wait
    }
}

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
        var fullPathWithoutExtension = fullpath.substring(0, lastDot);
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
 * Creates a 7-Zip archive of the file that is passed in then deletes it
 * @param  {string} fullpath Path to the file to compress and delete
 */
function createZip (fullpath) {
    // a     = create archive
    // -bd   = do not display a progress bar in the CLI
    // -tzip = create a zip formatted file
    // -mx=9 = use maximum compression
    // -y    = auto answer yes to all prompts
    var zipFile = getFullFileNameWithNewExtension(fullpath, '.7z');
    exec(zipExe + ' a -tzip -mx=9 -y "' + zipFile + '" "' + path.join(process.cwd(), fullpath) + '"');
    fs.removeSync(fullpath);
}

/**
 * Waits for FS activity to complete after file creation. Waits up to 5 seconds before bailing.
 * @param  {string} fullpath Path to the file to wait for
 * @param  {number} count    Counts to 5 before bailing
 * @return {boolean}         Returns success of file existing
 */
function waitForFile (fullpath, count) {
    if (fs.existsSync(path.join(fullpath)) && fs.statSync(fullpath).size > 0) {
        wait(1000);
        return true;
    } else if (count < 5) {
        wait(1000);
        count++;
        waitForFile(fullpath, count);
    } else {
        return false;
    }
}

/**
 * Unzips the 7-Zip file that is passed in and then waits for the file to be accessible
 * @param  {string} fullpath Zip file to unzip
 */
function unzip (fullpath) {
    // e     = extract archive
    // -o    = output folder
    var zipFile = getFullFileNameWithNewExtension(fullpath, '.7z');
    exec(zipExe + ' e "' + path.join(process.cwd(), zipFile) + '" -o"' + path.dirname(path.join(process.cwd(), fullpath)) + '"');
    waitForFile(getFullFileNameWithNewExtension(path.join(process.cwd(), fullpath), '.psd'), 0);
}

/**
 * Creates a PNG from a PSD. Then zips the PSD or deletes it if there is already a zip.
 * @param  {string} fullpath Path to the PSD
 */
function createPNG (fullpath) {
    var hasZip = checkForZippedVersion(fullpath);
    var psd = getFullFileNameWithNewExtension(fullpath, '.psd');
    var png = getFullFileNameWithNewExtension(fullpath, '.png');
    PSD.open(psd).then(function (psd) {
        return psd.image.saveAsPng(png);
    }).then(function () {
        if (!hasZip) {
            createZip(fullpath);
        } else {
            fs.removeSync(psd);
        }
    });
}

/**
 * Formats a message to be put in the console output in case of test failing.
 * @param  {string} fullpath File that caused the failure.
 * @param  {string} message  The help text specific to the error
 * @return {string}          The formatted error message to output to console.
 */
function throwError (fullpath, message) {
    var errorFile = '\n "' + fullpath + '"\n';
    var arrow = '\n\n' +
        '       ^\n' +
        '       | Try running this command to auto fix the problem:\n' +
        '       | npm run fix\n' +
        '       |\n\n\n';
    return '\n\n\n\n\n ' + message + errorFile + arrow;
}

/**
 * Recursive function to loop through all files/folders in the repo
 * and create PNG's and 7Z's for all PSD's.
 * @param  {string} folder This is the full folder path for recursive runs
 */
function fixFilesInFolder (folder) {
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
            var hasZip = checkForZippedVersion(fullpath);
            var fileAsPSD = getFullFileNameWithNewExtension(fullpath, '.psd');

            if (!hasPreview && fullpath.toLowerCase().endsWith('.psd')) {
                createPNG(fullpath);
            } else if (!hasPreview && fullpath.toLowerCase().endsWith('.7z') && !fs.existsSync(fileAsPSD)) {
                unzip(fullpath);
                createPNG(fullpath);
            } else if (!hasZip && fullpath.toLowerCase().endsWith('.psd')) {
                createZip(fullpath);
            } else if (hasPreview && hasZip && fullpath.toLowerCase().endsWith('.psd')) {
                fs.removeSync(fullpath);
            }
        } else if (isFolder && !isFile) {
            fixFilesInFolder(fullpath);
        }
    }
}

/**
 * Recursive function to loop through all files/folders in the repo
 * and throw errors in case of problems.
 * @param  {string} folder This is the full folder path for recursive runs
 */
function testFilesInFolder (folder) {
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
            var hasZip = checkForZippedVersion(fullpath);

            if (!hasPreview && fullpath.toLowerCase().endsWith('.psd')) {
                throw throwError(fullpath, 'Your PSD file does not have a preview png associated with it.');

            } else if (!hasPreview && fullpath.toLowerCase().endsWith('.7z')) {
                throw throwError(fullpath, 'Your 7-Zip file does not have a preview png associated with it.');

            } else if (!hasZip && fullpath.toLowerCase().endsWith('.psd')) {
                throw throwError(fullpath, 'PSD files are very large, compress it to a .7z file with npm run fix');

            } else if (hasPreview && hasZip && fullpath.toLowerCase().endsWith('.psd')) {
                throw throwError(fullpath, 'PSD files are very large, compress it to a .7z and delete the PSD from your branch');

            }
        } else if (isFolder && !isFile) {
            testFilesInFolder(fullpath);
        }
    }
}

gulp.task('fix', function () {
    fixFilesInFolder();
});

gulp.task('test', function () {
    testFilesInFolder();
});
