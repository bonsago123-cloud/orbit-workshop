"""Export a real public Git repository plus pinned source browser from final game source."""
import pathlib, subprocess, shutil, json, html, zipfile, os
root=pathlib.Path(__file__).resolve().parent
work=root/'.source-export'; public=root/'dist'; repo=work/'checkout'
if work.exists(): shutil.rmtree(work)
repo.mkdir(parents=True)
for name in ['README.md','package.json','preview-server.cjs','verify-core.cjs','verify-environment.cjs','export-source.py','build-report.py']:
 shutil.copy2(root/name,repo/name)
(repo/'dist').mkdir()
for file in public.iterdir():
 if file.is_file() and file.name not in ['source.zip','source.bundle','source-meta.json']:
  shutil.copy2(file,repo/'dist'/file.name)
env=dict(os.environ,GIT_AUTHOR_NAME='Orbit Workshop',GIT_AUTHOR_EMAIL='source@example.invalid',GIT_COMMITTER_NAME='Orbit Workshop',GIT_COMMITTER_EMAIL='source@example.invalid')
def git(*args,cwd=repo): return subprocess.check_output(['git',*args],cwd=cwd,env=env,text=True).strip()
git('init','-b','main');git('add','.');git('commit','-m','Complete modular rocket puzzle and reproducible verification')
sha=git('rev-parse','--verify','HEAD')
bare=public/'repository'
if bare.exists():
 git('fetch',str(repo),'+main:refs/heads/main',cwd=bare)
else:
 git('clone','--bare','--no-hardlinks',str(repo),str(bare))
git('update-ref','refs/tags/source-'+sha,sha,cwd=bare)
git('update-server-info',cwd=bare)
# A serving mirror needs only Git data, not hooks or a local path.
shutil.rmtree(bare/'hooks',ignore_errors=True)
(bare/'FETCH_HEAD').unlink(missing_ok=True)
(bare/'config').write_text('[core]\n\trepositoryformatversion = 0\n\tbare = true\n')
git('bundle','create',str(public/'source.bundle'),'--all')
git('archive','--format=zip','--output='+str(public/'source.zip'),'HEAD')
base=public/'source';base.mkdir(exist_ok=True);view=base/'commit'/sha;view.mkdir(parents=True,exist_ok=True)
shutil.copy2(public/'source.zip',view/'source.zip')
shutil.copy2(public/'source.bundle',view/'source.bundle')
style='<style>body{max-width:1040px;margin:40px auto;padding:0 24px;background:#0c1119;color:#dce8ed;font:15px Arial;line-height:1.8}a{color:#bbf77a}code,pre{font-family:monospace}pre{white-space:pre-wrap;background:#142131;padding:20px;border-radius:8px;overflow-wrap:anywhere}li{margin:12px 0}.sha{overflow-wrap:anywhere;color:#a5bac8}</style>'
files=git('ls-tree','-r','--name-only','HEAD').splitlines()
items=[]
for i,name in enumerate(files):
 target=f'file-{i}.html';content=(repo/name).read_text()
 (view/target).write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><title>'+html.escape(name)+'</title>'+style+'<a href="./">← 커밋 파일 목록</a><h1>'+html.escape(name)+'</h1><p class="sha">'+sha+'</p><pre>'+html.escape(content)+'</pre></html>')
 items.append(f'<li><a href="{target}">{html.escape(name)}</a></li>')
(view/'index.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>궤도 공작소 · 고정 커밋 소스</title>'+style+'<a href="../../">← 공개 소스 저장소</a><h1>궤도 공작소 · 소스 커밋</h1><p class="sha">'+sha+'</p><p>이 화면은 아래 전체 커밋의 고정된 소스 상태입니다. 실제 Git 저장소의 커밋이며, 모든 게임 파일과 검사 소스를 포함합니다.</p><p><a href="source.zip" download>전체 소스 ZIP</a> · <a href="source.bundle" download>Git bundle</a> · <a href="../../../../verification.html">검사 결과</a></p><p>Git bundle을 내려받은 후:</p><pre>git clone source.bundle orbit-workshop\ncd orbit-workshop\ngit checkout '+sha+'\nnode preview-server.cjs</pre><h2>커밋 파일</h2><ul>'+''.join(items)+'</ul></html>')
(base/'index.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>궤도 공작소 · 공개 Git 소스 저장소</title>'+style+'<a href="../">← 게임으로</a><h1>공개 Git 소스 저장소</h1><p>로그인 없이 전체 소스를 열고 받을 수 있는 읽기 전용 Git 저장소입니다.</p><p><a href="commit/'+sha+'/">전체 커밋 상세 보기</a></p><p class="sha">'+sha+'</p><p>제출 시 위 링크의 전체 주소를 소스 저장소 URL에 적으세요. GitHub 저장소로 제출해야 한다는 별도 안내가 있다면 ZIP을 본인 GitHub에 올린 뒤 해당 커밋 주소로 제출하세요.</p><p><a href="../source.bundle" download>Git bundle 내려받기</a> · <a href="../source.zip" download>소스 ZIP 내려받기</a></p></html>')
(public/'source-meta.json').write_text(json.dumps({'commit':sha,'path':'source/commit/'+sha+'/'},indent=2))
print(json.dumps({'commit':sha,'files':len(files)}))
