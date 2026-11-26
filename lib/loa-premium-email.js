// Premium Registry HTML email for ACC. Uses email-client-safe inline tables.
const IUC_PORTAL='https://innovative.vialing.com/sp/login';
const IUC_WHATSAPP='https://chat.whatsapp.com/B965syaRbyMHniDrwXmEyu';
const IUC_CARD='https://forms.gle/rDVdXAbzenxnUEeRA';
const IUC_LOGO='https://lh3.googleusercontent.com/d/1eOwwzXYC_aAWOgF4TGYTc8PNIBkcwsUI=s1000';

function htmlEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function cleanProgramme(v){return String(v||'').replace(/^\s*(?:MBA|MBM|DBA|PhD|PGDT|DPLI|MEDU|MHUM|MIS)\s*[-–]\s*/i,'').trim();}
function resolveAcceptanceLink(raw,preview){
  let u;try{u=new URL(String(raw||''));}catch{throw Error('Secure Acceptance URL missing or invalid.');}
  if(u.protocol!=='https:'||u.username||u.password)throw Error('Acceptance must use an HTTPS URL.');
  if(preview){
    if(!((u.hostname==='ipgs-admission-form.innovative.edu.my'||
        /^[a-z0-9-]+\.vercel\.app$/.test(u.hostname))&&
       u.pathname==='/acceptance-demo.html'))
      throw Error('Preview must use the ACC acceptance demo URL.');
  }else{
    const apps=u.hostname==='script.google.com'&&
      /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&
      u.searchParams.get('page')==='acceptance-v2';
    const acc=u.hostname==='ipgs-admission-form.innovative.edu.my'&&
      u.pathname==='/acceptance.html';
    if(!apps&&!acc)throw Error('Unrecognised Acceptance Portal.');
    if(!/^[A-Za-z0-9_-]{32,256}$/.test(u.searchParams.get('token')||''))
      throw Error('A student-specific Acceptance token is mandatory.');
  }
  return u.toString();
}
function emailButton(text,href,primary=false){
  const bg=primary?'#392975':'#F0EDF8',fg=primary?'#FFFFFF':'#342866',stroke=primary?'#392975':'#DED7F1';
  return '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width:100%;"><tr>'+
  '<td bgcolor="'+bg+'" style="background:'+bg+';border:1px solid '+stroke+';border-radius:9px;text-align:center;">'+
  '<a href="'+htmlEscape(href)+'" target="_blank" style="display:inline-block;padding:'+(primary?'16px 26px':'12px 18px')+
  ';font-family:Arial,Helvetica,sans-serif;font-size:'+(primary?'15':'13')+'px;font-weight:700;line-height:1.4;color:'+fg+';text-decoration:none;">'+htmlEscape(text)+'</a></td></tr></table>';
}
function serviceAction(label,href,theme){
  const color=theme==='green'?'#17705A':theme==='gold'?'#4B3A1E':'#30245F';
  const bg=theme==='green'?'#EAF7F2':theme==='gold'?'#F6F1E5':'#EEEAF8';
  const border=theme==='green'?'#C7E9DA':theme==='gold'?'#E9DDBE':'#DAD3ED';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td bgcolor="'+bg+
    '" align="center" style="background:'+bg+';border:1px solid '+border+';border-radius:9px;">'+
    '<a href="'+htmlEscape(href)+'" target="_blank" style="display:block;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;font-weight:700;color:'+color+';text-decoration:none;text-align:center;">'+
    htmlEscape(label)+'</a></td></tr></table>';
}
function serviceCard(num,tag,title,description,details,buttonLabel,href,theme){
  const accent=theme==='green'?'#22725C':theme==='gold'?'#98783B':'#3C3079';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 15px;border:1px solid #E7E3EF;background:#FFFFFF;">'+
    '<tr><td style="padding:21px 21px 22px;">'+
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>'+
    '<td width="46" valign="top" style="width:46px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="35" height="35" align="center" valign="middle" style="width:35px;height:35px;background:#F5F2FA;border-radius:8px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:'+accent+';">'+num+'</td></tr></table></td>'+
    '<td valign="top"><div style="font-family:Arial,sans-serif;font-size:10px;line-height:1.5;font-weight:700;letter-spacing:1.3px;color:'+accent+';">'+htmlEscape(tag)+'</div>'+
    '<h3 style="font-family:Arial,sans-serif;font-size:18px;line-height:1.35;font-weight:700;color:#302A51;margin:4px 0 10px;">'+htmlEscape(title)+'</h3></td></tr></table>'+
    '<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:#626A7B;margin:8px 0 16px;">'+htmlEscape(description)+'</p>'+
    details+
    serviceAction(buttonLabel,href,theme)+
    '</td></tr></table>';
}

function fileLine(n,title,note){
  return '<tr><td valign="top" style="padding:12px 4px 12px 0;border-bottom:1px solid #EDEAF4;color:#B49A61;font-size:13px;font-weight:700;width:29px;">'+n+'.</td>'+
  '<td valign="top" style="padding:12px 0;border-bottom:1px solid #EDEAF4;font-size:13px;color:#566175;line-height:1.6;"><strong style="color:#2D294B;">'+
  htmlEscape(title)+'</strong><br>'+htmlEscape(note)+'</td></tr>';
}
export function renderPremiumLoaHtml(input){
  const p=input||{},preview=p.preview===true,name=String(p.studentName||'Candidate').trim(),
    programme=cleanProgramme(p.programme),matric=String(p.matricNo||'');
  if(!programme||!/^\d{7}$/.test(matric))throw Error('ACC programme and seven-digit SKY matric are required.');
  const accept=resolveAcceptanceLink(p.acceptanceUrl,preview);
  const t=htmlEscape,details='<tr><td style="padding:10px 0"><span style="color:#9892AA;font-size:10px;font-weight:700;letter-spacing:1px;">STUDENT MATRIX NO.</span><br><strong style="font-size:14px;color:#30245F;">'+t(matric)+'</strong></td>'+
    '<td style="padding:10px 0"><span style="color:#9892AA;font-size:10px;font-weight:700;letter-spacing:1px;">INTAKE</span><br><strong style="font-size:13px;color:#30245F;">'+t(p.intake||'Refer to LOA')+'</strong></td></tr>';
  const banner=preview?'<tr><td style="padding:12px 28px;background:#FFF5DF;color:#80560A;font-size:12px;line-height:1.6;"><b>UAT DESIGN PREVIEW — NOT AN OFFICIAL LOA.</b> All details are synthetic. The Acceptance button opens a demo page, not a live student signing link.</td></tr>':'';
  const rows=[
    fileLine(1,'Official Letter of Admission','Your admission confirmation, registration information and tuition details.'),
    fileLine(2,'Acceptance of Offer (English)','For your reference; complete acceptance online using the secure button.'),
    fileLine(3,'Surat Penerimaan Tawaran IUC','Review the document before submitting your online acceptance.'),
    fileLine(4,'Surat Akuan IUC','Review the document before submitting your online acceptance.')
  ].join('');
  return '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
  '<body style="margin:0;padding:0;background:#F5F3F9;color:#2C3148;font-family:Arial,Helvetica,sans-serif;">'+
  '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">'+t(preview?'Design preview, not official.':'Your admission documents and secure online acceptance are ready.')+'</div>'+
  '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#F5F3F9"><tr><td align="center" style="padding:28px 12px;">'+
  '<table role="presentation" width="620" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;border:1px solid #E5DFEE;background:#FFF;">'+
  '<tr><td height="5" bgcolor="#BA9A59" style="height:5px;line-height:5px;font-size:1px;">&nbsp;</td></tr>'+banner+
  '<tr><td bgcolor="#2D2363" style="background:#2D2363;padding:30px 34px 32px;">'+
  '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="73" valign="middle"><img alt="IUC" src="'+IUC_LOGO+'" width="62" style="display:block;width:62px;height:auto;max-height:62px;border:0;"></td>'+
  '<td valign="middle" style="padding-left:12px;"><div style="color:#FFFFFF;font-size:18px;font-weight:700;line-height:1.4;">Innovative University College</div>'+
  '<div style="color:#E5DDF2;font-size:11px;letter-spacing:1.1px;line-height:1.8;">INSTITUTE OF POSTGRADUATE STUDIES</div></td></tr></table>'+
  '<div style="color:#E4C98F;font-size:11px;letter-spacing:1.7px;font-weight:700;padding-top:25px;">REGISTRY · ADMISSION OFFER</div>'+
  '<h1 style="color:#FFFFFF;font-size:29px;line-height:1.2;font-weight:700;letter-spacing:-.4px;margin:9px 0 12px;">Congratulations on your admission!</h1>'+
  '<p style="margin:0;color:#DED9ED;font-size:14px;line-height:1.65;">Your next academic chapter begins here.</p></td></tr>'+
  '<tr><td style="padding:30px 34px 34px;">'+
  '<p style="font-size:15px;color:#29314A;margin:0 0 16px;">Dear <strong>'+t(name)+'</strong>,</p>'+
  '<p style="font-size:14px;line-height:1.75;color:#555D6F;margin:0 0 14px;">Warm greetings from <strong>Innovative University College (IUC)</strong>.</p>'+
  '<p style="font-size:14px;line-height:1.75;color:#555D6F;margin:0 0 25px;">We are pleased to inform you that you have successfully fulfilled the entry requirements for the <strong>'+t(programme)+'</strong> programme at IUC. Congratulations on this significant achievement and welcome to our academic community.</p>'+
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E1F2;background:#FAF9FD;"><tr><td style="padding:21px 21px 8px;">'+
  '<div style="color:#9276BD;font-size:11px;font-weight:700;letter-spacing:1.4px;">YOUR ADMISSION DETAILS</div>'+
  '<div style="color:#30245F;font-size:18px;line-height:1.5;font-weight:700;padding-top:8px;">'+t(programme)+'</div></td></tr>'+
  '<tr><td style="padding:0 21px 15px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">'+details+'</table></td></tr></table>'+
  '<h2 style="font-size:18px;color:#30245F;margin:29px 0 8px;">Your admission documents</h2>'+
  '<p style="font-size:13px;line-height:1.7;color:#6E7483;margin:0 0 5px;">The following four PDFs are attached for your review and records:</p>'+
  '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">'+rows+'</table>'+
  '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F0FC;border:1px solid #E8E1F4;margin-top:28px;"><tr><td style="padding:23px 21px;">'+
  '<div style="color:#8A70B8;font-size:11px;font-weight:700;letter-spacing:1.3px;">NEXT STEP · ACTION REQUIRED</div>'+
  '<h2 style="font-size:21px;color:#30245F;margin:8px 0 10px;">Accept your offer online</h2>'+
  '<p style="font-size:13px;line-height:1.75;color:#576075;margin:0 0 19px;">Review your documents, confirm your details and sign electronically via the secure Acceptance Portal. You do not need to print, scan or submit an Acceptance Google Form.</p>'+
  emailButton(preview?'Preview Acceptance Portal':'Complete Online Acceptance',accept,true)+
  '<p style="font-size:11px;color:#78708A;line-height:1.6;margin:13px 0 0;">'+(preview?'Demo only — this button does not record an acceptance.':'This is your personal secure link. Please do not share it.')+'</p>'+
  '</td></tr></table>'+
  '<div style="border-top:1px solid #EAE6EF;margin:32px 0 27px;"></div>'+
  '<div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#9C8047;margin-bottom:7px;">STUDENT ONBOARDING</div>'+
  '<h2 style="font-family:Arial,sans-serif;font-size:22px;line-height:1.4;color:#30245F;margin:0 0 10px;">Your next steps at IUC</h2>'+
  '<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:#667080;margin:0 0 21px;">Here are the essential links and instructions to help you get started as a postgraduate student at IUC.</p>'+
  serviceCard('01','YOUR STUDENT ACCOUNT','Access the IUC Student Portal',
    'Your IUC Student Portal is your online access point for student-related information. Please use the credentials below to sign in.',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F8F7FC;border:1px solid #EBE7F3;margin:0 0 17px;"><tr><td style="padding:15px 16px;">'+
    '<div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.7px;color:#857C9C;font-weight:700;margin:0 0 5px;">STUDENT MATRIX NO.</div>'+
    '<div style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#30245F;margin:0 0 13px;">'+t(matric)+'</div>'+
    '<div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.9;color:#586075;"><strong style="color:#30245F;">Username:</strong> Matrix Number or Email Address<br>'+
    '<strong style="color:#30245F;">Initial Password:</strong> Your IC Number (without dashes)</div>'+
    '<div style="font-family:Arial,sans-serif;font-size:11px;line-height:1.65;color:#81869A;margin-top:8px;">Please keep your login details confidential.</div>'+
    '</td></tr></table>',
    'Access IUC Student Portal',IUC_PORTAL,'purple')+
  serviceCard('02','STAY CONNECTED','Join the Official Student Community',
    'Please join the official IUC Student WhatsApp Community for important announcements, orientation updates, class information, and further communication from the Registry Department.',
    '<p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#6A7584;margin:0 0 16px;">This is the designated community link for official student updates.</p>',
    'Join the Official WhatsApp Community',IUC_WHATSAPP,'green')+
  serviceCard('03','OPTIONAL STUDENT SERVICE','Apply for a Physical Student ID Card',
    'Students who require a physical Student ID Card are kindly requested to complete the application form using the button below.',
    '<p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#6A7584;margin:0 0 16px;">This application is intended for students who wish to obtain a physical student identification card.</p>',
    'Open Physical Student ID Card Application',IUC_CARD,'gold')+
  '<p style="font-size:13px;color:#576075;line-height:1.7;margin:27px 0 0;">We look forward to welcoming you to IUC.</p>'+
  '<p style="font-size:13px;color:#576075;line-height:1.7;margin:20px 0 0;">Warm regards,<br><b>Registry Department</b><br>Innovative University College</p>'+
  '</td></tr><tr><td style="padding:25px 34px;background:#F8F7FB;border-top:1px solid #E8E4F0;">'+
  '<div style="text-align:center;color:#8B90A0;font-size:11px;line-height:1.7;">Official Registry Communication · Innovative University College<br>Please keep this email and its four attachments for your records.</div>'+
  '</td></tr></table></td></tr></table></body></html>';
}
export function renderPremiumLoaText(input){
  const p=input||{},programme=cleanProgramme(p.programme),matric=String(p.matricNo||''),
    link=resolveAcceptanceLink(p.acceptanceUrl,p.preview===true);
  if(!programme||!/^\d{7}$/.test(matric))throw Error('LOA details missing.');
  return ['Dear '+String(p.studentName||'Candidate')+',','','Warm greetings from Innovative University College (IUC).','',
    'We are pleased to inform you that you have successfully fulfilled the entry requirements for the '+programme+' programme at IUC. Congratulations on this significant achievement and welcome to our academic community.','',
    'Your admission documents (four PDF attachments): Official Letter of Admission, Acceptance of Offer, Surat Penerimaan Tawaran IUC and Surat Akuan IUC.','',
    'Student Matrix No.: '+matric,'Intake: '+(p.intake||'Refer to your LOA'),'',
    'Complete Online Acceptance (secure personal link):',link,'',
    'Please review and sign electronically using the Acceptance Portal. No manual Acceptance Google Form is required.','',
    'Student Portal: '+IUC_PORTAL,'Username: Matrix Number or Email Address','Initial Password: Your IC Number (without dashes)','',
    'Official Student WhatsApp Community:',
    'Please join the official IUC Student WhatsApp Community for important announcements, orientation updates, class information, and further communication from the Registry Department.',
    IUC_WHATSAPP,'',
    'Application for Physical Student ID Card:',
    'Students who require a physical Student ID Card are kindly requested to complete the application form using the following link:',
    IUC_CARD,'','Warm regards,','Registry Department','Innovative University College'].join('\n');
}
