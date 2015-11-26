module.exports = ( function () {

  return {
    _id: '_design/kudu-adapter-couch',
    views: {

      type_id: {
        map: function ( doc ) {
          emit([ doc.type, doc._id ]);
        }.toString(),
      },

      'type-ancestor_type-ancestor_id': {
        map: function ( doc ) {

          var keys = Object.keys(doc).filter(function ( key ) {
            return /Id$/.test(key) && typeof doc[ key ] === 'string';
          });

          keys.forEach(function ( key ) {
            var ancestorType = key.substring(0, key.length - 2);
            emit([ doc.type, ancestorType, doc[ key ] ]);
          });
        }.toString(),
      }
    },
  };
}() );
