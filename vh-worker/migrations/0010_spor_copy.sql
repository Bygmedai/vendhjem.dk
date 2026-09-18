-- 0010 · Spor-teksterne på /sporene bringes i overensstemmelse med den copy,
-- Steven godkendte 15.09.2026 (S591/S592), og ingen ejer nævnes ved navn på
-- offentlige sider, før udkøbet af Erik er afsluttet. 0007 seedede den gamle
-- copy fra main; den godkendte lå kun på forken. Ren UPDATE, ingen skemaændring.
UPDATE opholdstyper SET
  beskrivelse = 'Weekender for femten mænd. Vi laver mad sammen, arbejder nogle timer på stedet og mødes om aftenen i en talerunde, hvor hver mand taler uden at blive afbrudt.'
WHERE id = 'ot-mandegrupper';
UPDATE opholdstyper SET
  navn = 'Retreats — vi er værter',
  beskrivelse = 'Du kan holde dit eget forløb her. Hele stedet fra onsdag til mandag, plads til femogtyve overnattende, med eller uden mad fra køkkenet. Du står selv for indholdet.'
WHERE id = 'ot-retreats';
UPDATE opholdstyper SET
  navn = 'Festival, burns og raves',
  beskrivelse = 'Vi laver vores egen, og vi lægger plads til dem, andre arrangerer. Sal, køkken og seks hektar gør stedet brugbart til både festival, burn og rave.'
WHERE id = 'ot-festival';
UPDATE opholdstyper SET
  beskrivelse = 'En uge, hvor du bor her, spiser med og arbejder på stedets opgaver. Vi går på værkstedet og i bygningerne sammen.'
WHERE id = 'ot-bygmed';
UPDATE opholdstyper SET
  beskrivelse = 'Et værelse og fred til at skrive, tænke eller holde fri i dit eget tempo. Du står selv for maden og for dagens indhold. Om vinteren kan et værelse lejes månedsvis.'
WHERE spor = 'stille';
UPDATE opholdstyper SET
  beskrivelse = 'Plads til at bo i din egen campingvogn i perioder. Prisen afhænger af, om opholdet også omfatter en aftale om at arbejde med.'
WHERE spor = 'campingvogne';
