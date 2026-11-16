"""Simulates Teach-it: a user tags k photos of each item type, then scans new photos.
'Item type' = a TrashBox sub-folder (e.g. plastic bottles, beverage cans): many different
objects per type, so this is harder than re-scanning the same physical item.
Unknown types: half the sub-folders are never taught; matches to them count as false matches."""
import json, numpy as np, random, collections, sys
rows=[json.loads(l) for f in ("feat0.jsonl","feat1.jsonl") for l in open(f)]
def grp(f):
    p=f.split("/"); return "/".join(p[1:-1])
G=collections.defaultdict(list)
for r in rows: G[grp(r["f"])].append(r)
groups=sorted(G)
def n(v): v=np.asarray(v,dtype=np.float32); return v/ (np.linalg.norm(v)+1e-9)
def emb(r,kind):
    if kind=="obj": return n(r["o"])
    if kind=="waste": return n(r["w"])
    if kind=="both": return n(np.concatenate([n(r["o"]),n(r["w"])]))
def run(kind,k,T,margin,seed):
    rng=random.Random(seed); taught=set(rng.sample(groups,len(groups)//2))
    ex=[];test=[]
    for g in groups:
        rs=G[g][:]; rng.shuffle(rs)
        if g in taught: ex+= [(g,emb(r,kind)) for r in rs[:k]]; test+=[(g,emb(r,kind),True) for r in rs[k:]]
        else: test+=[(g,emb(r,kind),False) for r in rs]
    E=np.stack([e for _,e in ex]); L=[g for g,_ in ex]
    res=collections.Counter()
    for g,q,known in test:
        s=E@q; best={}
        for lab,v in zip(L,s): best[lab]=max(best.get(lab,-1),v)
        top=sorted(best.items(),key=lambda kv:-kv[1]); b,bs=top[0]; s2=top[1][1] if len(top)>1 else -1
        matched = bs>=T and bs-s2>=margin
        if known: res["known"]+=1; res["k_match_right"]+= matched and b==g; res["k_match_wrong"]+= matched and b!=g
        else: res["unknown"]+=1; res["u_false"]+= matched
    return res
def summ(kind,k,T,margin):
    tot=collections.Counter()
    for seed in range(5): tot+=run(kind,k,T,margin,seed)
    return tot["k_match_right"]/tot["known"], tot["k_match_wrong"]/tot["known"], tot["u_false"]/tot["unknown"]
for kind in ("obj","waste","both"):
    for T in (0.0,0.6,0.7,0.75,0.8,0.85):
        r=summ(kind,5,T,0.03); print(f"{kind:5} k=5 T={T:.2f}: right {r[0]:.3f} wrong {r[1]:.3f} | unknown falsely matched {r[2]:.3f}")
