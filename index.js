/**
 * @author Erik Desjardins
 * See LICENSE file in root directory for full license.
 */

'use strict';

var path = require('path');
var rollup = require('rollup');

function splitRequest(request) {
	var split = request.split('!');
	if (split.length === 1) {
		return {
			loaders: '',
			resource: split[0]
		};
	} else {
		return {
			loaders: split[0] + '!',
			resource: split[1]
		};
	}
}

module.exports = function(source, sourceMap) {
	var callback = this.async();

	var entryId = this.resourcePath;

	var maps = {};

	rollup
		.rollup({
			entry: entryId,
			plugins: [{
				resolveId: function(id, importerId) {
					if (id === entryId) {
						return entryId;
					} else {
						return new Promise(function(resolve, reject) {
							// split apart resource paths because Webpack's this.resolve() can't handle `loader!` prefixes
							var parts = splitRequest(id);
							var importerParts = splitRequest(importerId);

							// resolve the full path of the imported file with Webpack's module loader
							// this will figure out node_modules imports, Webpack aliases, etc.
							this.resolve(path.dirname(importerParts.resource), parts.resource, function(err, fullPath) {
								if (err) {
									reject(err);
									return;
								}
								// add dependency for watch mode
								this.addDependency(fullPath);
								resolve(parts.loaders + fullPath);
							}.bind(this));
						}.bind(this));
					}
				}.bind(this),
				load: function(id) {
					if (id === entryId) {
						return source;
					}
					return new Promise(function(resolve, reject) {
						// load the module with Webpack
						// this will apply all relevant loaders, etc.
						this.loadModule(id, function(err, source, map, module) {
							if (err) {
								reject(err);
								return;
							}
							maps[id] = map;
							resolve(source);
						});
					}.bind(this));
				}.bind(this),
				transform: function(code, id) {
					if (id === entryId) {
						return { code: source, map: sourceMap };
					}

					return { code: code, map: maps[id] };
				}
			}]
		})
		.then(function(bundle) {
			var result = bundle.generate({ format: 'es' });
			callback(null, result.code, result.map);
		}, function(err) {
			callback(err);
		});
};