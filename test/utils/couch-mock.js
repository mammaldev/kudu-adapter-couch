export default class MockCouch {

  insert( doc ) {

    return Promise.resolve({
      _id: '1',
      _rev: '1',
    });
  }

  update( doc ) {

    return Promise.resolve({
      _id: '1',
      _rev: '2',
    });
  }

  get( id ) {

    return Promise.resolve(
      Array.isArray(id) ?
        [
          {
            _id: '1',
            _rev: '1',
          },
        ] :
        {
          _id: '1',
          _rev: '1',
        }
    );
  }

  fetch( ids ) {

    return Promise.resolve([
      { _id: '1', _rev: '1' },
    ]);
  }

  view( design, view ) {

    return Promise.resolve({
      rows: [
        { doc: { _id: '1', _rev: '1' } },
        { doc: { _id: '2', _rev: '1' } },
      ],
    });
  }

  viewDocs( design, view ) {

    return Promise.resolve([
      { _id: '1', _rev: '1' },
      { _id: '2', _rev: '1' },
    ]);
  }
}
