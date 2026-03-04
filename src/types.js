"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentFormat = void 0;
/**
 * Detected content format
 */
var ContentFormat;
(function (ContentFormat) {
    ContentFormat["Unknown"] = "unknown";
    ContentFormat["AsciiDoc"] = "asciidoc";
    ContentFormat["Markdown"] = "markdown";
    ContentFormat["Wikipedia"] = "wikipedia";
    ContentFormat["Plain"] = "plain";
})(ContentFormat || (exports.ContentFormat = ContentFormat = {}));
