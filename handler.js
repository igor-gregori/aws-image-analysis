'use strict';

const { promises: { readFile } } = require('fs')
const { get } = require('axios');

class Handler {

  constructor({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc
    this.translatorSvc = translatorSvc
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise()

    const workingItems = result.Labels.filter(({ Confidence }) => {
      return Confidence > 60
    })

    const names = workingItems.map(({ Name }) => {
      return Name
    }).join(' and ')

    return { names, workingItems }
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }

    const { TranslatedText } = await this.translatorSvc
      .translateText(params)
      .promise()

    return TranslatedText.split(' e ')
  }

  formatTextResults(texts, workingItems) {
    const finalText = []
    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText]
      const confidence = workingItems[indexText].Confidence;
      finalText.push(
        ` ${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`

      )
    }
    return finalText.join('\n')
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer'
    })
    return Buffer.from(response.data, 'base64')
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters

      console.log('Downloading image...')
      const imgBuffer = await this.getImageBuffer(imageUrl)

      console.log('Detecting labels ...')
      const { names, workingItems } = await this.detectImageLabels(imgBuffer)

      console.log('Tanslating to Portuguese...')
      const texts = await this.translateText(names)

      console.log('Handling final object...')
      const finalText = this.formatTextResults(texts, workingItems)

      console.log('Finishing...')
      return {
        statusCode: 200,
        body: `A imagem tem\n `.concat(finalText)
      }
    } catch (error) {
      console.log('Error:', error.stack)
      return {
        statusCode: 500,
        body: 'Internal server error!'
      }
    }
  }
}

const aws = require('aws-sdk')
const reko = new aws.Rekognition()
const translator = new aws.Translate()
const handler = new Handler({
  rekoSvc: reko,
  translatorSvc: translator
})

module.exports.main = handler.main.bind(handler)
