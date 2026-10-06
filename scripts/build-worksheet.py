#!/usr/bin/env python3
"""Phase 1 lookup worksheet. Rows are RESEARCH TARGETS, not asserted facts.
Date and number columns are deliberately BLANK - the source fills them, not a model."""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

HEAD=Font(name='Arial',bold=True,color='FFFFFF',size=10); HF=PatternFill('solid',fgColor='1F3864')
BODY=Font(name='Arial',size=10); WRAP=Alignment(wrap_text=True,vertical='top')
THIN=Border(*[Side(style='thin',color='D9D9D9')]*4)
FILLME=PatternFill('solid',fgColor='FFF2CC'); DONE=PatternFill('solid',fgColor='E2EFDA')

# ---- PATENT TARGETS: subject only. Number and date are looked up, never recalled.
PATENTS=[
("Westinghouse automatic air brake","air brake","US 124,405 - already verified, use as the worked example"),
("Janney knuckle coupler","coupler","Two patents exist: an 1868 one and US 138,405 of 1873. Which one is your story?"),
("Miller platform and buffer","coupler","Superseded by Janney - a good 'why it lost' story"),
("Westinghouse quick-action triple valve","air brake","1887 trials made it the standard"),
("Elijah McCoy automatic lubricator","lubrication","Multiple patents; pick one and cite its number"),
("Granville T. Woods induction telegraph","signalling","Train-to-station communication"),
("Granville T. Woods electromechanical brake","brakes",""),
("Andrew Jackson Beard Jenny coupler","coupler","Verify the relationship to Janney's design carefully"),
("Frank Sprague multiple-unit control","traction","The reason metro trains work as they do"),
("George Pullman folding upper berth","passenger",""),
("Ezra Miller car platform","passenger",""),
("Robert Stevens T-rail","track","Invented aboard ship; check whether it was ever patented"),
("Joseph Rogers Brown vernier caliper","manufacturing","Precision that made interchangeable parts possible"),
("Sylvester Roper / steam carriage","traction",""),
("Charles Page electromagnetic locomotive","traction",""),
("William Robinson track circuit","signalling","The foundation of automatic block signalling"),
("Union Switch and Signal interlocking patents","signalling",""),
("Timken tapered roller bearing","mechanical",""),
("Buckeye steel casting coupler","coupler",""),
("Thermit rail welding process","track","Goldschmidt; check the German patent"),
("Sperry rail flaw detector car","maintenance",""),
("Willard Kelly / automatic train stop","signalling",""),
("Vapor Clarkson steam car heating","passenger",""),
("Barney and Smith / vestibule diaphragm","passenger","Pullman vestibule 1887"),
("Diesel compression-ignition engine","traction","German patent; check both DE and US filings"),
("Hermann Lemp electric transmission control","traction","Made the diesel-electric practical"),
("Ward Leonard control system","traction",""),
("Roller bearing journal box","mechanical",""),
("Dynamic braking / regenerative braking","traction",""),
("Centralized Traffic Control patents","signalling","GRS, 1927 onward"),
]

# ---- PEOPLE: birth and death dates are civil-registration facts. Look them up.
PEOPLE=[
("Eli H. Janney","coupler inventor","VERIFIED EXAMPLE: b. 12 Nov 1831, d. 16 Jun 1912, Alexandria VA"),
("George Westinghouse","air brake",""),("Elijah McCoy","lubrication",""),
("Granville T. Woods","electrical signalling",""),("Andrew Jackson Beard","coupler",""),
("Frank J. Sprague","electric traction",""),("Richard Trevithick","first steam locomotive",""),
("George Stephenson","Rocket, Liverpool & Manchester",""),("Robert Stephenson","bridges, locomotives",""),
("Isambard Kingdom Brunel","Great Western Railway",""),("Joseph Locke","civil engineering",""),
("Daniel Gooch","GWR locomotive superintendent",""),("Nigel Gresley","Mallard, A4 pacifics",""),
("William Stanier","LMS Princess Coronation",""),("Oliver Bulleid","Southern Railway",""),
("Andre Chapelon","French steam thermodynamics",""),("Livio Dante Porta","Argentine steam efficiency",""),
("Anna Sayre / women in rail","social history","Research who actually fits here"),
("Mary Pennington","refrigerated rail transport",""),("Olive Dennis","B&O service engineer",""),
("Hideo Shima","Shinkansen chief engineer",""),("Karl Golsdorf","Austrian locomotive design",""),
("Rudolf Diesel","compression ignition","Already in corpus: b. 18 Mar 1858, Paris"),
("Werner von Siemens","electric railway",""),("Frank Julian Sprague","see above - dedupe",""),
("Theodore Judah","Central Pacific","Already in corpus"),
("Grenville Dodge","Union Pacific","Already in corpus"),
("James J. Hill","Great Northern","Already in corpus"),
("Octave Chanute","Hannibal Bridge, later aviation",""),
("Claudius Crozet","Blue Ridge Tunnel",""),
("Emily Roebling","Brooklyn Bridge - adjacent but relevant",""),
("A. Philip Randolph","Brotherhood of Sleeping Car Porters",""),
("Eugene V. Debs","rail labour","Already in corpus"),
("Herbert Garratt","articulated locomotive",""),
("Anatole Mallet","compound articulated locomotives",""),
("Wilhelm Schmidt","superheating",""),
("Egide Walschaerts","valve gear",""),
("Ross Winans","early B&O locomotives",""),
("Matthias Baldwin","Baldwin Locomotive Works","Partly in corpus"),
]

wb=openpyxl.Workbook(); wb.remove(wb.active)

def sheet(name, rows, kind):
    ws=wb.create_sheet(name)
    cols=(["#","Subject","Theme","Note / trap to watch",
           "PATENT NO (fill)","GRANT DATE (fill)","FILED DATE (fill)","INVENTOR AS ON PATENT (fill)"]
          if kind=='patent' else
          ["#","Person","Known for","Note / trap to watch",
           "BIRTH DATE (fill)","DEATH DATE (fill)","BIRTHPLACE (fill)","PRECISION (fill)"])
    cols += ["SOURCE 1 (fill)","SOURCE 2 (fill)","PAIRING OK? (y/n)","STATUS"]
    for j,h in enumerate(cols,1):
        c=ws.cell(row=1,column=j,value=h); c.font=HEAD; c.fill=HF; c.alignment=WRAP
    for i,(subj,theme,note) in enumerate(rows,2):
        vals=[i-1,subj,theme,note,'','','','','','','','TODO']
        for j,v in enumerate(vals,1):
            c=ws.cell(row=i,column=j,value=v); c.font=BODY; c.alignment=WRAP; c.border=THIN
            if 5<=j<=11 and not v: c.fill=FILLME
        if 'VERIFIED EXAMPLE' in note or 'already verified' in note:
            for j in range(1,13): ws.cell(row=i,column=j).fill=DONE
            ws.cell(row=i,column=12,value='EXAMPLE')
    dv=DataValidation(type='list',formula1='"TODO,IN_REVIEW,VERIFIED,DISPUTED,DROP"',allow_blank=True)
    ws.add_data_validation(dv); dv.add(f'L2:L{len(rows)+1}')
    ws.freeze_panes='C2'; ws.auto_filter.ref=f'A1:L{len(rows)+1}'
    for k,w in zip('ABCDEFGHIJKL',[4,34,22,46,16,16,16,24,30,30,12,12]):
        ws.column_dimensions[k].width=w
    for r in range(2,len(rows)+2): ws.row_dimensions[r].height=40

# HOW TO sheet first
ws=wb.create_sheet('HOW_TO'); ws.sheet_view.showGridLines=False
txt=[("PHASE 1 LOOKUP WORKSHEET - patents and people",True),("",False),
("These rows are RESEARCH TARGETS, not facts. The date and number columns are blank",False),
("on purpose. A model recalling a patent number is exactly the failure this project",False),
("has been fighting. The source fills those cells, not a model and not you from memory.",False),("",False),
("WHY THESE TWO BLOCKS",True),
("Patents: 0.07 hours per airable episode, the best ratio available. A patent has a",False),
("number, a grant date and a named assignee. No definitional argument, no ceremony",False),
("versus service ambiguity. It is also the direct antidote to failure mode D - a patent",False),
("number IS the pairing check. Had FE0037 carried US 124,405, the Westinghouse error",False),
("could not have happened.",False),
("People: birth and death are civil registration facts. Unambiguous, and they fill the",False),
("thin calendar months cheaply while still carrying a story.",False),("",False),
("THE TRAP, SHOWN BY A REAL EXAMPLE",True),
("Eli Janney. Nearly every source says he patented the knuckle coupler in 1873, US",False),
("138,405, granted 29 April. ASME says his FIRST patent was 21 April 1868 and that 1873",False),
("was his second. Both statements are true. 'Janney patented the knuckle coupler' is",False),
("therefore a mode A and mode D trap even in the cleanest category in the corpus.",False),
("Decide which patent your story is about and say so. That decision IS the pairing check.",False),("",False),
("PER ROW, DO THIS",True),
("1. Find the patent or the record. Copy the NUMBER and the GRANT date, not a summary.",False),
("2. Find a second independent source. Not a second site quoting the first.",False),
("3. Answer the pairing question: does the date, the person and the claim all belong to",False),
("   the SAME patent? This is the only column that cannot be automated.",False),
("4. Set PRECISION honestly. If you only found a year, write YEAR. Do not guess a day.",False),
("5. Set STATUS. DROP is a legitimate outcome and costs nothing.",False),("",False),
("Then run: node scripts/promote.mjs worksheet.xlsx   to merge VERIFIED rows into the pool.",False),
("The schema will reject anything missing two sources, a pairing check, or a precision.",False),("",False),
("BUDGET",True),
("30 patents + 40 people = 70 targets, about 4 to 5 minutes each = 5 to 6 hours.",False),
("That is roughly 23 weeks of episodes at three a week, and it takes the corpus past 1900",False),
("for the first time.",False)]
for i,(t,b) in enumerate(txt,1):
    ws.cell(row=i,column=1,value=t).font=Font(name='Arial',size=11,bold=b,color='1F3864' if b else '000000')
ws.column_dimensions['A'].width=100

sheet('PATENTS',PATENTS,'patent')
sheet('PEOPLE',PEOPLE,'people')
wb.save('/mnt/user-data/outputs/PHASE1_lookup_worksheet.xlsx')
print(f"patents {len(PATENTS)}  people {len(PEOPLE)}  total targets {len(PATENTS)+len(PEOPLE)}")
