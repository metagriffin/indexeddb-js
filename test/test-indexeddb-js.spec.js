// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the indexeddb-js module
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
  '../src/indexeddb-js'
], function(_, sqlite3, indexeddbjs) {

  describe('indexeddb-js', function() {

    var j = function(o) { return JSON.stringify(o); };

    //-------------------------------------------------------------------------
    var createTestDb = function(cb) {
      // var sdb   = new sqlite3.Database('./test.db');
      var sdb   = new sqlite3.Database(':memory:');
      var scope = indexeddbjs.makeScope('sqlite3', sdb);
      var req   = scope.indexedDB.open('testdb');
      req.onerror = function(event) { cb('error: ' + event.target.error.name); };
      req.onversionchange = function(event) { cb('error: unexpected version change'); };
      req.onblocked = function(event) { cb('error: unexpected version change'); };
      req.onupgradeneeded = function(event) {
        var db = event.target.result;
        var store = db.createObjectStore('data', {keyPath: 'id'});
        store.createIndex('value', 'value', {unique: false});
        store.createIndex('count', 'count', {unique: false});
        var store2 = db.createObjectStore('longdata', {keyPath: 'id'});
        store2.createIndex('name', 'name', {unique: false});
        store.add({id: '1', value: 'foo1', count: 3}).onsuccess = function() {
          store.add({id: 2, value: 'zapper', count: 23}).onsuccess = function() {
            store.add({id: '3', value: 'zapper', count: 15}).onsuccess = function() {
              store2.add({id: 'long-id-1', name: 'long-name-1'}).onsuccess = function() {
                store2.add({id: 'long-id-2', name: 'long-name-2'}).onsuccess = function() {
                  // TODO: this is a hack, but there is just no
                  // other way to support this until indexeddb-js
                  // supports transactions!... ugh.
                  if ( event.onupgradecomplete )
                    event.onupgradecomplete();
                };
              };
            };
          };
        };
      };
      req.onsuccess = function(event) {
        var db = event.target.result;
        return cb(null, db, scope);
      };
    };

    //-------------------------------------------------------------------------
    it('implements CRUD for a simple record', function(done) {
      createTestDb(function(err, db) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
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
                          done();
                        };
                    };
                  };
              };
            };
        };
      });
    });

    //-------------------------------------------------------------------------
    it('supports index-based access to key/data', function(done) {
      createTestDb(function(err, db) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
        };
        db.transaction().objectStore('data').index('value').get('foo1')
          .onsuccess = function(event) {
            expect(event.target.result.id).toEqual('1');
            db.transaction().objectStore('data').index('value').getKey('foo1')
              .onsuccess = function(event) {
                expect(event.target.result).toEqual('1');
                done();
              };
          };
      });
    });

    //-------------------------------------------------------------------------
    it('supports cursor-based access to key/data', function(done) {
      createTestDb(function(err, db) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
        };
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
              done();
            };
        };
      });
    });

    //-------------------------------------------------------------------------
    it('supports IDBKeyRange.only() operation', function(done) {
      createTestDb(function(err, db, scope) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
        };
        var dataset = [];
        db.transaction().objectStore('data').index('value')
          .openCursor(scope.IDBKeyRange.only('zapper'))
          .onsuccess = function(event) {
            var cursor = event.target.result;
            if ( cursor )
            {
              dataset.push(cursor.value.id + ':' + cursor.value.value);
              return cursor.continue();
            }
            dataset.sort()
            expect(dataset).toEqual(['2:zapper', '3:zapper']);
            done();
          };
      });
    });

    //-------------------------------------------------------------------------
    it('supports IDBKeyRange.bound() (closed) operation', function(done) {
      createTestDb(function(err, db, scope) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
        };
        var dataset = [];
        db.transaction().objectStore('data').index('count')
          .openCursor(scope.IDBKeyRange.bound(3, 15))
          .onsuccess = function(event) {
            var cursor = event.target.result;
            if ( cursor )
            {
              dataset.push(cursor.value.id + ':' + cursor.value.value);
              return cursor.continue();
            }
            dataset.sort()
            expect(dataset).toEqual(['1:foo1', '3:zapper']);
            done();
          };
      });
    });

    //-------------------------------------------------------------------------
    it('supports IDBKeyRange.bound() (lower-open) operation', function(done) {
      createTestDb(function(err, db, scope) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
        };
        var dataset = [];
        db.transaction().objectStore('data').index('count')
          .openCursor(scope.IDBKeyRange.bound(3, 15, true))
          .onsuccess = function(event) {
            var cursor = event.target.result;
            if ( cursor )
            {
              dataset.push(cursor.value.id + ':' + cursor.value.value);
              return cursor.continue();
            }
            dataset.sort()
            expect(dataset).toEqual(['3:zapper']);
            done();
          };
      });
    });

    //-------------------------------------------------------------------------
    it('supports IDBKeyRange.bound() (upper-open) operation', function(done) {
      createTestDb(function(err, db, scope) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
        };
        var dataset = [];
        db.transaction().objectStore('data').index('count')
          .openCursor(scope.IDBKeyRange.bound(3, 15, false, true))
          .onsuccess = function(event) {
            var cursor = event.target.result;
            if ( cursor )
            {
              dataset.push(cursor.value.id + ':' + cursor.value.value);
              return cursor.continue();
            }
            dataset.sort()
            expect(dataset).toEqual(['1:foo1']);
            done();
          };
      });
    });

    //-------------------------------------------------------------------------
    it('supports IDBKeyRange.bound() (open) operation', function(done) {
      createTestDb(function(err, db, scope) {
        expect(err).toBeFalsy();
        if ( err )
          return done();
        db.onerror = function(event) {
          // don't expect any errors to bubble up
          expect('db.onerror').toBe('never called');
          return done();
        };
        var dataset = [];
        db.transaction().objectStore('data').index('count')
          .openCursor(scope.IDBKeyRange.bound(3, 15, true, true))
          .onsuccess = function(event) {
            var cursor = event.target.result;
            if ( cursor )
            {
              dataset.push(cursor.value.id + ':' + cursor.value.value);
              return cursor.continue();
            }
            dataset.sort()
            expect(dataset).toEqual([]);
            done();
          };
      });
    });


    //-------------------------------------------------------------------------
    it('runs the example program from the documentation', function(done) {

      // TODO: it would be *great* if i could auto-extract the
      // example from README.md instead of needing to duplicate it here...

      var output = '';
      var _console = console;
      var console = {
        log: function(msg) {
          output += msg + '\n';
        }
      }
      var final_check = function() {
        expect(output).toEqual(
          'record: {"id":1,"value":"my-first-item"}\n'
            + 'deleted the record\n'
            + 'added two more records\n'
            + 'all objects with the "value" field set to "another object":\n'
            + '  - {"id":"2","value":"another object"}\n'
            + '  - {"id":3,"value":"another object"}\n'
        );
        done();
      };


var engine    = new sqlite3.Database(':memory:');
var scope     = indexeddbjs.makeScope('sqlite3', engine);
var request   = scope.indexedDB.open('MyDatabase');
var db        = null;

request.onerror = function(event) {
  console.log('ERROR: could not open database: ' + event.target.error);
  done();
};

request.onupgradeneeded = function(event) {
  db = event.target.result;
  var store = db.createObjectStore('data', {keyPath: 'id'});
  store.createIndex('value', 'value', {unique: false});
  store.add({id: 1, value: 'my-first-item'}).onsuccess = function() {
    // TODO: there is currently a limitation in indexeddb-js that
    // does not allow it to know when an upgrade has been finished,
    // and therefore you must tell it by calling "event.onupgradecomplete()"
    // (otherwise ``request.onsuccess()`` will not be called).
    if ( event.onupgradecomplete )
      event.onupgradecomplete();
  };
};

request.onsuccess = function(event) {
  db = event.target.result;
  request.run();
};

request.run = function() {

  // register an error handler for any error on the current db
  db.onerror = function(event) {
    console.log('DATABASE ERROR: ' + event.target.error);
  };

  // fetch the record with id "1" in store "data"
  var store = db.transaction(null, 'readwrite').objectStore('data');
  store.get('1').onsuccess = function(event) {
    var obj = event.target.result;
    console.log('record: ' + JSON.stringify(obj));

    // now delete it
    store.delete('1').onsuccess = function(event) {
      console.log('deleted the record');

      // and now add a couple new records (overwriting it if the key
      // already exists) with the same 'value' (so we can play with cursors)
      store.put({id: '2', value: 'another object'}).onsuccess = function(event) {
        store.put({id: 3, value: 'another object'}).onsuccess = function(event) {
          console.log('added two more records');

          // we're getting pretty deeply nested here... let's pop out
          // and use the index
          play_with_the_index_and_cursors();

        };
      };
    };
  };

  var play_with_the_index_and_cursors = function() {

    var index = db.transaction(null, 'readwrite').objectStore('data').index('value');
    var range = scope.IDBKeyRange.only('another object');

    console.log('all objects with the "value" field set to "another object":');

    index.openCursor(range).onsuccess = function(event) {
      var cursor = event.target.result;
      if ( ! cursor )
        return final_check();

      console.log('  - ' + JSON.stringify(cursor.value));
      cursor.continue();
    };

  };

};

    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
