/** @babel */
import fs from 'fs';
import stdPath from 'path';

import fuzzaldrin from 'fuzzaldrin-plus';
import mkdirp from 'mkdirp';
import touch from 'touch';

import * as config from './config';
import {
    absolutify,
    cachedProperty,
    defineImmutable,
    getProjectPath,
    preferredSeparatorFor
} from './utils';


/**
 * Wrapper for dealing with filesystem paths.
 */
export class Path {
    constructor(path='') {
        // The last path segment is the "fragment". Paths that end in a
        // separator have a blank fragment.
        let sep = preferredSeparatorFor(path);
        let parts = path.split(sep);
        let fragment = parts[parts.length - 1];
        let directory = path.substring(0, path.length - fragment.length);

        // Set non-writable properties.
        defineImmutable(this, 'directory', directory);
        defineImmutable(this, 'fragment', fragment);
        defineImmutable(this, 'full', path);
        defineImmutable(this, 'absolute', absolutify(path));
        defineImmutable(this, 'sep', sep);
    }

    isProjectDirectory() {
        return atom.project.getPaths().indexOf(this.absolute) !== -1;
    }

    isRoot() {
        return stdPath.dirname(this.absolute) === this.absolute;
    }

    hasCaseSensitiveFragment() {
        return this.fragment !== '' && this.fragment !== this.fragment.toLowerCase();
    }

    asDirectory() {
        return new Path(this.full + (this.fragment ? this.sep : ''));
    }

    parent() {
        if (this.isRoot()) {
            return this;
        } else if (this.fragment) {
            return new Path(this.directory);
        } else {
            let newFull = stdPath.dirname(this.directory);

            // Only append a separator if necessary.
            if (!newFull.endsWith(this.sep)) {
                newFull += this.sep;
            }

            return new Path(newFull);
        }
    }

    /**
     * Return path for the root directory for the drive this path is on.
     */
    root() {
        let last = null;
        let current = this.absolute;
        while (current !== last) {
            last = current;
            current = stdPath.dirname(current);
        }

        return new Path(current);
    }

    /**
     * Check if the last path fragment in this path is equal to the given
     * shortcut string, and the path ends in a separator.
     *
     * For example, ':/' and '/foo/bar/:/' have the ':' shortcut, but
     * '/foo/bar:/' and '/blah/:' do not.
     */
    hasShortcut(shortcut) {
        shortcut = shortcut + this.sep;
        return !this.fragment && (
            this.directory.endsWith(this.sep + shortcut)
            || this.directory === shortcut
        )
    }

    equals(otherPath) {
        return this.full === otherPath.full;
    }

    /**
     * Return the path to show initially in the path input.
     */
    static initial() {
        switch (config.get('defaultInputValue')) {
            case config.DEFAULT_ACTIVE_FILE_DIR:
                let editor = atom.workspace.getActiveTextEditor();
                if (editor && editor.getPath()) {
                    return new Path(stdPath.dirname(editor.getPath()) + stdPath.sep);
                }
                // No break so that we fall back to project root.
            case config.DEFAULT_PROJECT_ROOT:
                let projectPath = getProjectPath();
                if (projectPath) {
                    return new Path(projectPath + stdPath.sep);
                }
        }

        return new Path('');
    }

    /**
     * Compare two paths lexicographically.
     */
    static compare(path1, path2) {
        return path1.full.localeCompare(path2.full);
    }

    /**
     * Return a new path instance with the common prefix of all the
     * given paths.
     */
    static commonPrefix(paths, caseSensitive=false) {
        if (paths.length < 2) {
            throw new Error(
                'Cannot find common prefix for lists shorter than two elements.'
            );
        }

        paths = paths.map((path) => path.full).sort();
        let first = paths[0];
        let last = paths[paths.length - 1];

        let prefix = '';
        let prefixMaxLength = Math.min(first.length, last.length);
        for (let k = 0; k < prefixMaxLength; k++) {
            if (first[k] === last[k]) {
                prefix += first[k];
            } else if (!caseSensitive && first[k].toLowerCase() === last[k].toLowerCase()) {
                prefix += first[k].toLowerCase();
            } else {
                break;
            }
        }

        return new Path(prefix);
    }
}
