module.exports = ( function () {

  return {
    _id: '_design/kudu-adapter-couch',
    views: {

      type_id: {
        map: function ( doc ) {
          emit([ doc.type, doc._id ]);
        }.toString(),
      },
    },
  };
}() );
