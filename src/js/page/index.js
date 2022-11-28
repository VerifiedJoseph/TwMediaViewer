import JSZip from 'jszip'
import Papa from 'papaparse'

import { Helper } from '../Helper.js'
import { Dom } from '../Dom.js'
import { Filter } from '../Filter.js'
import { Build } from '../Build.js'

import '../../css/style.css'
import '../../css/dark.css'
import '../../images/meta-image.png'

/**
 * Search the zip file for the required CSV file
 */
function findCsvFile (zip) {
  const regex = /\.csv$/
  let filename = null

  for (const [key, info] of Object.entries(zip.files)) {
    if (regex.test(info.name) === true) {
      console.log(`CSV file: ${info.name} (${key})`)
      filename = info.name
    }
  }

  if (filename === null) {
    throw Error('No CSV file not found in zip file.')
  }

  return filename
}

/**
 * Process the CSV file and create an array of tweets
 */
async function processCsvFile (filename, zip) {
  return new Promise((resolve) => {
    zip.file(filename).async('text').then(function (content) {
      const results = Papa.parse(content)

      const data = {
        tweets: [],
        users: [],
        stats: {
          users: 0,
          tweets: 0,
          images: 0,
          videos: 0
        }
      }

      let rowsAfter = 0
      for (let index = 0; index < results.data.length; index++) {
        if (results.data[index][0] === 'Tweet date') {
          rowsAfter = index
          break
        }
      }

      results.data.forEach((row, index) => {
        if (index > rowsAfter) {
          if (Helper.getUserIndex(row[3], data.users) === -1) {
            const user = {
              display_name: row[2],
              username: row[3],
              tweets: 0
            }

            data.stats.users++
            data.users.push(user)
          }

          const id = Helper.getIdFromUrl(row[4])
          const tweetIndex = Helper.getTweetIndex(id, data.tweets)
          const userIndex = Helper.getUserIndex(row[3], data.users)

          if (tweetIndex === -1) {
            const tweet = {
              date: row[0],
              display_name: row[2],
              username: row[3],
              url: row[4],
              id,
              media: [],
              stats: {
                images: 0,
                videos: 0,
                replies: Number(row[10]),
                retweets: Number(row[11]),
                likes: Number(row[12])
              },
              remarks: row[8],
              text: row[9]
            }

            const media = {}
            if (row[5] !== 'No media') {
              media.type = row[5]
              media.url = row[6]
              media.filename = row[7]
              tweet.media.push(media)

              if (row[5] === 'Image' || row[5] === 'GIF') {
                data.stats.images++
                tweet.stats.images++
              } else {
                data.stats.videos++
                tweet.stats.videos++
              }
            }

            data.stats.tweets++
            data.users[userIndex].tweets++

            data.tweets.push(tweet)
          } else if (tweetIndex !== -1 && row[5] !== 'No media') {
            const media = {
              type: row[5],
              url: row[6],
              filename: row[7]
            }

            if (row[5] === 'Image' || row[5] === 'GIF') {
              data.stats.images++
              data.tweets[tweetIndex].stats.images++
            } else {
              data.stats.videos++
              data.tweets[tweetIndex].stats.videos++
            }

            data.tweets[tweetIndex].media.push(media)
          }
        }
      })

      resolve(data)
    })
  })
}

/**
 * Load a zip archive and display tweets
 */
function loadFile (input) {
  Dom.hideError()
  Filter.clearUsernames()

  if (input.target.files === undefined) {
    return
  }

  Dom.clearTweets()
  Dom.show('loading')
  Dom.enableInput('close-file')

  console.log('File: ' + input.target.files[0].name)

  const reader = new FileReader()
  reader.onload = function (ev) {
    JSZip.loadAsync(ev.target.result)
      .then(async function (zip) {
        const csvFilename = findCsvFile(zip)
        const data = await processCsvFile(csvFilename, zip)
        const autoload = document.getElementById('autoload').checked

        Dom.hide('loading')
        Dom.hide('about')

        Build.page(data, zip, autoload)

        Dom.enableInput('media-filter-reset')
        Dom.enableInput('media-filter')

        document.getElementById('username-filter').addEventListener('change', function (e) {
          Filter.run(data)
        })

        document.getElementById('media-filter').addEventListener('change', function (e) {
          Filter.run(data)
        })

        document.getElementById('username-filter-reset').addEventListener('click', function (e) {
          document.getElementById('username-filter').getElementsByTagName('option')[0].selected = 'selected'
          Filter.run(data)
        })

        document.getElementById('media-filter-reset').addEventListener('click', function (e) {
          document.getElementById('media-filter').getElementsByTagName('option')[0].selected = 'selected'
          Filter.run(data)
        })

        if (autoload === false) {
          const placeholders = document.getElementsByClassName('placeholder')

          for (let i = 0; i < placeholders.length; i++) {
            placeholders[i].addEventListener('click', function (e) {
              const id = e.target.getAttribute('data-tweet-id')
              const index = Helper.getTweetIndex(id, data.tweets)
              const media = Build.media(data.tweets[index].media, zip)

              e.target.parentNode.replaceChild(media, e.target)
            })
          }
        }
      })
      .catch(function (err) {
        Dom.hide('loading')
        Dom.displayError('Failed to load tweets.')
        Dom.show('about')
        console.error(err)
      })
  }
  reader.onerror = function (err) {
    Dom.hide('loading')
    Dom.displayError('Failed to read file.')
    console.error('Failed to read file', err)
  }
  reader.readAsArrayBuffer(input.target.files[0])
}

document.getElementById('close-file').addEventListener('click', function (e) {
  document.getElementById('zip-file').value = ''

  Dom.hide('username-filter-text')
  Dom.disableInput('username-filter-reset')
  Dom.disableInput('username-filter')
  Dom.disableInput('media-filter-reset')
  Dom.disableInput('media-filter')

  Dom.disableInput('close-file')
  Dom.clearTweets()
  Filter.clearUsernames()
  Dom.show('about')
  Dom.hide('error')
})

document.getElementById('zip-file').addEventListener('change', loadFile)

Dom.enableInput('zip-file')
Dom.enableInput('autoload')