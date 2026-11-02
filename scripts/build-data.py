import json,sys
from datetime import datetime
from zoneinfo import ZoneInfo
src,out=sys.argv[1],sys.argv[2]
d=json.load(open(src))
tz=ZoneInfo('America/Detroit')
P={p['id']:p for p in d['people']}
T={t['id']:t for t in d['contentTypes']}
TR={t['id']:t['name'] for t in d['tracks']}
S={s['id']:s for s in d['sessions']}
TS={t['id']:t for t in d['timeSlots']}
R={r['id']:r for r in d['rooms']}
FL={rid:f['name'] for f in d['floors'] for rid in f['roomIds']}
C={c['id']:c for c in d['contents']}
AHL={ # program personId lastname/first -> slug, section
 'Suranga Nanayakkara':('suranga-nanayakkara','Principal Investigator'),
 'Dinithi Dissanayake':('dinithi-dissanayake','Current Team'),
 'Prasanth Sasikumar':('prasanth-sasikumar','Alumni'),
 'Muftee Mysan':('mohamed-muftee','Alumni'),
 'Soundarya Ramesh':('soundarya-ramesh','Alumni'),
 'Peter Cleveland':('peter-cleveland','Current Team'),
 'Ryo Hajika':('ryo-hajika','Current Team'),
 'Mia Huong Nguyen':('mia-huong-nguyen','Alumni'),
 'Jochen Huber':('jochen-huber','Alumni'),
 'Chitralekha Gupta':('chitralekha-gupta','Current Team'),
 'Nadia Aritonang':('nadia-aritonang','Current Team'),
 'Timothy Antoni':('timothy-antoni','Current Team'),
 'Pattie Maes':('pattie-maes','Collaborators'),
 'Takuma Masuda':('takuma-masuda','Alumni'),
}
PROJ={276185:'factually',262865:'gutio',277827:'gutio'}
PROJNOTE={276185:'Strong match: ahlab.org project "Factually" (wearable real-time fact-checker; same team).',
 262865:'Related, not identical: ahlab.org project "GutIO" (gut-sensing line of work, shared authors Mia Huong Nguyen, Jochen Huber). No OpenGut project page exists yet.',
 277827:'Related, not identical: ahlab.org project "GutIO" (gut-sensing line of work, shared authors Mia Huong Nguyen, Jochen Huber). No OpenGut project page exists yet.'}
IMG={262865:'assets/projects/opengut.jpg',277827:'assets/projects/opengut.jpg'}  # local images override the ahlab.org project photo
PAIR={262865:277827,277827:262865,262870:277848,277848:262870,262857:277889,277889:262857}
ids=[262857,262865,262870,275455,275891,276185,277827,277848,277889]
from datetime import timezone as _Z
# SIGCHI program JSON encodes local wall-clock time as if UTC; reattach America/Detroit (EST, UTC-5 after DST ends 1 Nov 2026)
def iso(ms): return datetime.fromtimestamp(ms/1000,_Z.utc).replace(tzinfo=tz)
entries=[]
for i in ids:
  c=C[i]; s=S[c['sessionIds'][0]]; ts=TS[s['timeSlotId']]; st,en=iso(ts['startDate']),iso(ts['endDate'])
  room=R.get(s['roomId'],{})
  authors=[];members=[]
  for a in c['authors']:
    p=P[a['personId']]; name=(p['firstName']+' '+p['lastName']).strip()
    m=AHL.get(name)
    authors.append({'name':name,'affiliations':[{k:v for k,v in af.items()} for af in a['affiliations']],
      'ahlSlug':m[0] if m else None})
    if m: members.append({'name':name,'slug':m[0],'url':f'https://ahlab.org/people/{m[0]}/','section':m[1]})
  slug=PROJ.get(i)
  t=T[c['typeId']]
  entries.append({
    'id':i,'importedId':c['importedId'],
    'type':t['name'],'track':TR.get(c['trackId']),
    'title':c['title'],'authors':authors,'abstract':c.get('abstract'),'keywords':c.get('keywords',[]),
    'session':{'id':s['id'],'name':s['name'],'note':s.get('note')},
    'date':st.strftime('%Y-%m-%d'),'day':st.strftime('%A'),
    'start':st.isoformat(),'end':en.isoformat(),
    'timeLocal':f"{st.strftime('%-I:%M %p')} - {en.strftime('%-I:%M %p')} {st.tzname()}",
    'timezone':'America/Detroit','tzAbbrev':st.tzname(),
    'timeNote':'Session time slot; the program does not give per-presentation times within the session.',
    'room':room.get('name'),'floor':FL.get(s['roomId']),
    'doi':None,'acmDlUrl':None,'videos':[],'awards':[{'id':r} for r in c.get('recognitionIds',[])],
    'url':f'https://programs.sigchi.org/uist/2026/program/content/{i}',
    'relatedEntryId':PAIR.get(i),
    'ahl':{'projectSlug':slug,'projectUrl':f'https://ahlab.org/projects/{slug}/' if slug else None,
           'image':IMG.get(i) or (f'https://cdn.ahlab.org/media/site/projects/{slug}/{slug}.jpg' if slug else None),
           'matchNote':PROJNOTE.get(i),'members':members}})
conf=d['conference']
allts=[t for t in d['timeSlots']]
cs=iso(min(t['startDate'] for t in allts)); ce=iso(max(t['endDate'] for t in allts))
out_d={'conference':{'name':conf['name'],'fullName':conf['fullName'],
  'dates':{'start':cs.strftime('%Y-%m-%d'),'end':ce.strftime('%Y-%m-%d'),'label':'2-5 November 2026'},
  'venue':'Renaissance Center, Detroit (program rooms on Levels 3-5); Doctoral Symposium at U-M Detroit Center (Dearborn & Flint rooms)',
  'city':conf['location'],'timezone':conf['timeZoneName'],'url':conf['url'],
  'programUrl':'https://programs.sigchi.org/uist/2026',
  'searchUrl':'https://programs.sigchi.org/uist/2026/search/content?searchKey=Suranga',
  'dataSource':'https://files.sigchi.org/conference/program/UIST/2026',
  'dataPublished':d['publicationInfo']['publicationDate'],'dataVersion':d['publicationInfo']['version']},
  'entries':entries}
json.dump(out_d,open(out,'w'),indent=2,ensure_ascii=False)
for e in entries: print(e['type'],'|',e['title'][:60],'|',e['day'],e['date'],e['timeLocal'],'|',e['room'],'|',e['floor'],'|',[m['slug'] for m in e['ahl']['members']])
print(out_d['conference']['dates'], [(r['name'],FL.get(r['id'])) for r in d['rooms'] if r['id'] in (12557,12711)])
