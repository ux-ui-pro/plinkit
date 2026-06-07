npm whoami
npm logout
npm login


ВЕРСИОНИРОВАНИЕ РАЗРАБОТКИ

1.0.0-dev.0
npm publish --tag dev

Патч:
2.0.0 → 2.0.1-dev.0 → 2.0.1-dev.1 → 2.0.1

Минорное обновление:
2.0.0 → 2.1.0-dev.0 → 2.1.0-dev.1 → 2.1.0

Мажорное обновление (breaking changes):
2.0.0 → 3.0.0-dev.0 → 3.0.0-dev.1 → 3.0.0



$ git add .
$ git commit -m "release 1"

$ git tag -a v1.0.0 -m "1.0.0"
$ git push origin master --follow-tags
$ npm publish
