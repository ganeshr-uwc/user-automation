const data = require('../../data.json')

if(data.length > 0) {
    for(let i = 0; i < data.length; i++) {
       console.log(data[i].phone_number + " - " + data[i].audio_url)
    }
}

module.exports = { validateJson };