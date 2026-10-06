#!/usr/bin/env python3
"""Migrate the audited corpus into pool/items.json + quarantine/items.json. ASCII-only (Gotcha 3)."""
import pandas as pd, json, re, unicodedata

SRC='/mnt/user-data/outputs/rail_pool_production.xlsx'
live=pd.read_excel(SRC,sheet_name='POOL_LIVE')
feats=pd.read_excel(SRC,sheet_name='FEATS')
quar=pd.read_excel(SRC,sheet_name='QUARANTINE')

MAP={'\u2014':' - ','\u2013':'-','\u2019':"'",'\u2018':"'",'\u201c':'"','\u201d':'"','\u2026':'...'}
def A(v):
    if not isinstance(v,str): return v
    for k,r in MAP.items(): v=v.replace(k,r)
    v=unicodedata.normalize('NFKD',v)
    return ''.join(ch for ch in v if ord(ch)<128).strip()

def nn(v, d=''):
    return d if (v is None or (isinstance(v,float) and pd.isna(v))) else v

events=[]
for _,r in live.iterrows():
    events.append({
        "id": A(r['ID']),
        "type": "event",
        "month": int(r['Month']), "day": int(r['Day']), "year": int(r['Year']),
        "anniversary": A(r['Anniversary']),
        "title": A(r['Title']),
        "region": A(nn(r['Region'],'Unknown')),
        "category": A(nn(r['Category'],'General')),
        "storyFacts": A(nn(r['Story_Facts'])),
        "hook": A(nn(r['Hook'])),
        "source": A(nn(r['Source'])),
        "confidence": A(nn(r['Confidence'],'B')),
        "ageRating": A(r['Age_Rating']),
        "contentFlags": [x for x in A(nn(r['Content_Flags'])).split(',') if x],
        "scaleAnchor": None,
        "displayName": nn(r['Title']),
    })

def parse_scale(nums, feat):
    """Only emit scaleAnchor when a clean primary number is present. Never invent."""
    if not isinstance(nums,str): return None
    m=re.search(r'(\d[\d,\.]*)\s*(km|m|ft|mi|percent)\b', nums)
    if not m: return None
    val=float(m.group(1).replace(',',''))
    unit=m.group(2)
    return {"value":val,"unit":unit,"dimension":"length" if unit in("km","mi") else "height",
            "comparison":None,"comparisonValue":None}

for _,r in feats.iterrows():
    if not isinstance(r.get('Feat'),str) or not r['Feat'].strip(): continue
    events.append({
        "id": "FE%04d" % int(r['#']) if not pd.isna(r.get('#')) else "FE0000",
        "type": "feat",
        "month": None, "day": None, "year": A(str(nn(r['Year']))),
        "anniversary": None,
        "title": A(r['Feat']),
        "region": A(nn(r['Region'],'Global')),
        "category": A(nn(r['Discipline'],'Engineering')),
        "storyFacts": A(nn(r['Key Numbers'])),
        "hook": A(nn(r['The Ingenuity'])),
        "source": "Show research file; verify superlatives at script time",
        "confidence": A(nn(r['Conf'],'B')),
        "ageRating": "ALL_AGES",
        "contentFlags": [],
        "scaleAnchor": parse_scale(nn(r['Key Numbers']), r['Feat']),
        "displayName": r['Feat'],
    })

qids=[A(x) for x in quar[quar['Quarantine_Status'].str.contains('REMOVED',na=False)]['ID'].tolist()]
qitems=[{"id":A(r['ID']),"title":A(r['Title']),"year":int(r['Year']),
         "reason":A(nn(r['Quarantine_Reason']))} for _,r in quar.iterrows()]

# hard assertion: no quarantined id in the live pool
ids={e['id'] for e in events}
leak=set(qids)&ids
assert not leak, f"QUARANTINE LEAK: {leak}"

with open('/home/claude/rbu/data/items.json','w',encoding='ascii') as f:
    json.dump({"version":1,"items":events},f,indent=1,ensure_ascii=True)
with open('/home/claude/rbu/data/quarantine.json','w',encoding='ascii') as f:
    json.dump({"version":1,"blockedIds":qids,"items":qitems},f,indent=1,ensure_ascii=True)

ev=[e for e in events if e['type']=='event']
print("events:",len(ev),"| feats:",len(events)-len(ev))
print("ALL_AGES events:",sum(1 for e in ev if e['ageRating']=='ALL_AGES'))
print("feats with scaleAnchor:",sum(1 for e in events if e['scaleAnchor']))
print("blocked ids:",qids)
