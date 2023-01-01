#!/usr/bin/env zx
/* eslint-disable no-undef */

import repositories from '../const/repositories.js'

const env = argv.env;
if (!env) {
  throw new Error('required env');
}
console.log(`${env}対象のPRを作成します。`)

// Slack通知用にPR URLをまとめる配列
const mergeabletUrls = []
const conflictUrls = []

const getTargetBranch = (envBranch) => {
  let base = ''
  let head = ''
  switch (env) {
    case 'develop': {
      base = envBranch.develop
      head = envBranch.production
      break
    }
    case 'staging': {
      base = envBranch.staging
      head = envBranch.develop
      break
    }
    case 'production': {
      base = envBranch.production
      head = envBranch.staging
      break
    }
  }
  return {base, head}
};

const getDate = () => {
  const today = new Date()
  const date = `${today.getMonth() + 1}${today.getDate()}`
  return date
}

const createPullRequest = async(repository) => {
  const {base, head} = getTargetBranch(repository.envBranch)
  const date = getDate()

  return await $`gh pr create \
  -R https://github.com/shibatani/${repository.name} \
  --base ${base} \
  --head ${head} \
  --title "${head} to ${base} ${date}" \
  --body ""`
}

const getStatus = async(name, pullRequestNumber) => {
  return await $`gh pr status \
   -R https://github.com/shibatani/${name} \
   --json mergeable,number \
   --jq '.createdBy[] | select(.number == ${pullRequestNumber}) | .mergeable'`
}

const getTargetArray = (status) => {
  switch (status) {
    case 'MERGEABLE': return mergeabletUrls
    case 'CONFLICTING': return conflictUrls
  }
}

const createDataForSlackNotification = (name, status, pullRequestNumber) => {
  getTargetArray(status).push({
    url: `https://github.com/shibatani/${name}/pull/${pullRequestNumber}`,
  })
}

const main = async() => {
  // 順次実行させるためにfor文で書く。
  for (let i = 0; i < repositories.length; i++ ) {
    try {
      const repository = repositories[i]
      console.log(`${repository.name}のPR作成を開始します。`)
  
      // PRを作成する。
      const createPullRequestResult = await createPullRequest(repository)
      const pullRequestNumber = createPullRequestResult.stdout.replace(/[^0-9]/g, '');
      
      // PR作成後、すぐにstatus情報を取得できないので待つ。
      await sleep(3000);
      
      // PRのstatusを取得する。
      const getStatusResult = await getStatus(repository.name, pullRequestNumber);
      const status = getStatusResult.stdout.trim()

      // Slack通知用のデータを作成する。
      createDataForSlackNotification(repository.name, status, pullRequestNumber) 
      console.log(`${repository.name}のPR作成を終了しました。`)
    } catch(e) {
      console.error(e)
    }
  }
}

main()
