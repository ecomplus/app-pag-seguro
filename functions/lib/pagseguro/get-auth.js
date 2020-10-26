module.exports = ({ admin, storeId }) => admin.firestore()
  .collection('pagseguro_app_auth')
  .where('store_id', '==', storeId)
  .get()
  .then(snapshot => {
    if (snapshot.empty) {
      const error = new Error('No authentication found')
      error.name = 'AuthNotFound'
      throw error
    }

    let data
    snapshot.forEach(doc => {
      const auth = doc.data()
      if (
        !data || !data.updated_at ||
        (auth.updated_at && auth.updated_at.seconds >= data.updated_at.seconds)
      ) {
        data = auth
      }
    })

    return {
      ...data,
      authorizationCode: data.authorization_code
    }
  })
