// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the jsindexeddb module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'sqlite3',
  '../src/jsindexeddb'
], function(_, sqlite3, jsindexeddb) {

  describe('jsindexeddb', function() {

    var done = false;

    var j = function(o) { return JSON.stringify(o); };

    //-------------------------------------------------------------------------
    beforeEach(function(callback) {

      var sdb = new sqlite3.Database('./test.db');
      // var sdb = new sqlite3.Database(':memory:');
      var idb = new jsindexeddb.indexedDB('sqlite3', sdb);

      var req = idb.open('testdb');
      var db  = null;

      req.onerror = function(event) {
        // console.log('req.onerror');
      };

      req.onupgradeneeded = function(event) {
        // console.log('req.onupgradeneeded');
        db = event.target.result;

        var store = db.createObjectStore('data', {keyPath: 'id'});
        store.createIndex('value', 'value', {unique: false});

        var store2 = db.createObjectStore('longdata', {keyPath: 'id'});
        store2.createIndex('name', 'name', {unique: false});

        store.add({id: '1', value: 'foo1'}).onsuccess = function() {
          store.add({id: 2, value: 'zapper'}).onsuccess = function() {
            store.add({id: '3', value: 'zapper'}).onsuccess = function() {
              store2.add({id: 'long-id-1', name: 'long-name-1'}).onsuccess = function() {
                store2.add({id: 'long-id-2', name: 'long-name-2'}).onsuccess = function() {
                  req.run();
                };
              };
            };
          };
        };
      };

      req.onversionchange = function(event) {
        // console.log('req.onversionchange');
      };

      req.onblocked = function(event) {
        // console.log('req.onblocked');
      };

      req.onsuccess = function(event) {
        // console.log('req.onsuccess');
        db = event.target.result;
        req.run();
      };

      req.run = function() {
        // console.log('run');

        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
        };

        // try read
        db.transaction().objectStore('data').get('1').onsuccess = function(event) {
          // console.log('fetched data: ' + j(event.target.result));
          expect(event.target.result.value).toEqual('foo1');
          // try write
          db.transaction(null, 'readwrite').objectStore('data')
            .put({id: 1, value: 'foo2'}).onsuccess = function(event) {
              // console.log('putted data');
              // confirm write
              db.transaction().objectStore('data').get('1').onsuccess = function(event) {
                // console.log('second fetched data: ' + j(event.target.result));
                expect(event.target.result.value).toEqual('foo2');
                // try delete
                db.transaction(null, 'readwrite').objectStore('data')
                  .delete('1').onsuccess = function(event) {
                    // console.log('deleted data');
                    // confirm delete
                    db.transaction().objectStore('data').get('1').onerror = function(event) {
                      event.preventDefault();
                      // console.log('third fetch failed, as expected');
                      // and reverting to the initial value
                      db.transaction(null, 'readwrite').objectStore('data')
                        .put({id: '1', value: 'foo1'}).onsuccess = function(event) {
                          testIndeces();
                        };
                    };
                  };
              };
            };
        };

        // indeces...
        var testIndeces = function() {
          db.transaction().objectStore('data').index('value').get('foo1')
            .onsuccess = function(event) {
              expect(event.target.result.id).toEqual('1');
              db.transaction().objectStore('data').index('value').getKey('foo1')
                .onsuccess = function(event) {
                  expect(event.target.result).toEqual('1');
                  testCursors();
                };
            };
        };

        // cursors...
        var testCursors = function() {
          var dataset = [];
          db.transaction().objectStore('data').openCursor().onsuccess = function(event) {
            var cursor = event.target.result;
            if ( cursor )
            {
              dataset.push(cursor.value.id + ':' + cursor.value.value);
              return cursor.continue();
            }
            dataset.sort()
            expect(dataset).toEqual(['1:foo1', '2:zapper', '3:zapper']);
            dataset = [];
            db.transaction().objectStore('data').index('value').openCursor('zapper')
              .onsuccess = function(event) {
                var cursor = event.target.result;
                if ( cursor )
                {
                  dataset.push(cursor.value.id + ':' + cursor.value.value);
                  return cursor.continue();
                }
                dataset.sort()
                expect(dataset).toEqual(['2:zapper', '3:zapper']);
                done = true;
                callback();
              };
          };
        };

      };

    });

    it('implements CRUD for a simple record', function() {
      expect(done).toBe(true);
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
