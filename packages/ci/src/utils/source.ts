'use strict'
const got = require('got')
const git = require('./git')
import {Command} from '@heroku-cli/command'

import * as fs from 'async-file'
import {ux} from 'cli-ux'

async function uploadArchive(url: string, filePath: string) {
  const request = got.stream.put(url, {
    headers: {
      'content-length': (await fs.stat(filePath)).size
    }
  })

  fs.createReadStream(filePath).pipe(request)

  return new Promise((resolve: any, reject: any) => {
    request.on('error', reject)
    request.on('response', resolve)
  })
}

async function prepareSource(ref: any, command: Command) {
  const filePath = await git.createArchive(ref)
  const {body: source} = await command.heroku.post<any>('/sources')
  await uploadArchive(source.source_blob.put_url, filePath)
  return Promise.resolve(source)
}

async function urlExists(url: any) {
  return got.head(url)
}

export async function createSourceBlob(ref: any, command: Command) {
  try {
    const githubRepository = await git.githubRepository()
    const {user, repo} = githubRepository

    let {body: archiveLink} = await command.heroku.get<any>(`https://kolkrabbi.heroku.com/github/repos/${user}/${repo}/tarball/${ref}`)
    if (await urlExists(archiveLink.archive_link)) {
      return archiveLink.archive_link
    }
  } catch (ex) {
    // the commit isn't in the repo, we will package the local git commit instead
    ux.debug(`Commit not found in pipeline repository: ${ex}`)
  }

  const sourceBlob = await prepareSource(ref, command)
  return sourceBlob.source_blob.get_url
}
