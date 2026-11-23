// The German words of share word codes (`words.ts`): 1024 short, common words, only a–z (no letters a keyboard
// may lack), none of them in the other language's list. Their order is their number: never change or reorder it –
// codes shown by one version must still be read by the next.

const WORDS = `
abend acker adler affe ahorn alpen ameise amsel angel apfel arbeit ast atem auge ausflug auto bach backofen
bahn banane bart bauer baum becher beere besen bett biene bild birke birne blatt blitz blume boden bogen bohne
brief brille brot brunnen buch bucht burg busch dach dackel dampf daumen decke delfin dorf drache draht
dreieck duft dusche efeu ehre eiche eimer eis eisen elch ente erbse erde ernte esel eule fabrik faden fahne
farbe fass feder fee feld felsen fenster ferien fest feuer fichte flasche fliege floh flosse flugzeug fluss
frosch frucht fuchs funke gabel gans garten gast gebirge geige geld gemse gesicht giebel gipfel glas glocke
gras gurke gurt hafen hafer hagel hahn haken hals hase haube haus hecht hecke heft held helm hemd henne herbst
herz heu himmel hirsch hitze hobel hof honig huhn hund igel insel jacke jagd jahr joghurt jubel kabel kaffee
kahn kakao kamel kamin kamm kanal kanne kante karte kasse kater katze kegel keller kerze kessel kette kiefer
kirche kirsche kissen kiste klee knopf koch koffer kohl komet kopf korb korn kranich kraut kreis kresse krone
kuchen kugel lachs laden lager lampe land laterne laub leder leiter lerche licht linde linse loch luchs luft
magen maler mantel mappe marder markt maus meer meise melone messer milch minze mond moos motte muschel muster
nabel nacht nadel nagel nase natter nebel netz nudel nuss obst ofen ohr onkel orgel paket palme papier pappel
pause pfanne pfeffer pfeife pferd pflaume pinsel pirat platz pudel pulver puppe quark quelle rabe rad rahmen
rakete rasen raupe regen reh reifen reis rinde rost ruder saal sack saft salat salbe salz schaf schal schiff
schild schirm schloss schnee schrank schuh see segel seife seil sense sessel sieb socke sommer sonne spatz
spiegel spinne stall stein stern stiefel stirn strand strauch strom stuhl sturm suppe tal tanne tante tasche
tasse tau teich teller tennis teppich tinte tisch topf traube treppe trommel tuch tulpe turm uhr ufer vater
vogel volk waage wagen wald wasser watte weg weide wein weizen welle wiese wolke wurm wurst zange zaun zelt
ziege zimmer zitrone zucker zug zunge zwerg zwiebel ahnung allee anker anzug apotheke aufzug ausweis bagger
balken bambus barren bauch becken beet beil berg beutel biber bibel binse blase blech blei bluse bohrer boje
bremse brett brise brocken brosche bruder brust buche buckel bude bulle bummel bunker dattel deich diamant
diele dose dotter drossel eber egge eidechse eiland enkel erker falke falter fasan faust fehde feige feile
ferkel fessel filz fink firma flagge flamme flocke flur fohlen forelle fuder gabe galle gelee gerste gewitter
gitarre glut gnom graben grube gruss gummi hacke hai halde halle halm harfe harke haufen hebel heide hering
hirse hocker holz hummel hummer hupe imker jacht joch kabine kachel kahl kajak kalb kaktus kalender kamille
kammer kanu kapelle kappe karpfen karren kasten kauz kelle kelter kerbe kerl kern kiesel kino kittel klavier
kleid klinge klippe kloster knie knochen knoten kobold koje kompass kopie korken kralle kran krippe krug
kuppel kutsche lack lamm lappen latte laune lauch leim lehm leier leuchte lexikon libelle lied linie lotse
lupe luke mais mandel mangel mantra marmor maske masse matte mauer meile meister mehl mieze mikrofon morgen
mulde munde mutter nabe nelke nichte nische nixe norden notiz oase ochse oma opa orkan paddel palast panne
papa pappe paprika parfum pass pate pelz perle pfad pfau pfote pilz pinguin plakat plane platte pokal polster
posaune post pracht presse prinz pult pumpe punkt quader quaste rampe ranke rasse rassel rathaus raum rechen
regal reise rentier riegel riese rippe rocker rolle rubin ruhe sahne saite salami sattel scheibe schere
schlange schule schwan sekt senf sichel siegel silber sirene skizze sockel sohn sole sonde spaten speck spitze
sporn sprosse spule spur stadt stange stapel staub stempel steuer stich stift stock storch strick stufe sumpf
tafel takt tapete taube teig tempel tenne thron tiegel tonne torte tracht trage trichter troll truhe tube uhu
umhang urlaub veilchen vlies vorhang wabe wache wachs wade waffel walze wanne watt wecker weiche weste wetter
wichtel widder wimper winkel wippe wolle zacke zapfen zehe zeile zettel ziegel zirkus zither zopf zuber
zwinger amboss angler ansicht ausguck bader balkon bande barke baustein bergsee besteck biest bischof bock
bohle bolzen borke borste brause brezel bube bussard dachs dame deckel diener docht dohle donner dorn drachen
dreirad drohne eckstein elster emaille engel erdbeere fackel fahrrad fasching fehler fernglas fiedel filter
fischer flegel flieder floss forst frack fritte fuchsbau fussball gamasche garbe gasse gefieder geier gerte
geselle gewicht glaser gondel gong graupel greif grille habicht halsband hantel harz haspel heimat heiler
heuboden himbeere hirte hufeisen jongleur kaiser kapuze kasper kerbel kiebitz kinder kleister klette klinke
knabe knappe knauf knirps kobra kohle kolben koralle korsar kreide kreuz kuckuck kuh kuss kutter lagune
lakritz larve lasso lilie limonade lineal lorbeer lotto magier mammut manege mangold marone matrose maulwurf
medaille mosaik murmel musik nachen narr nashorn nilpferd oktave orchidee osterei pagode papagei pastete pauke
pavillon pelikan pfeil pfirsich pflug pforte pinie pinzette pirol plakette posten prisma quadrat quitte rauch
raute rebe rechner reiher reiter rettich riemen ritter rodel roggen rosine rucksack rummel samt sandale
schaukel schaufel schemel schimmel schinken schnabel schnecke schnur schopf schote schraube schwalbe schwamm
segler seilbahn sellerie semmel sippe skorpion spargel spinat spirale sprotte stachel staffel stelze strudel
stummel taler tamburin tankwart teekanne tenor tomate topas torbogen trompete tropfen truthahn tukan tunika
turban uhrwerk ulme unke vanille vorrat wachtel walnuss walross wanderer wappen weiher weinberg weltall wiege
wiesel wirbel zander zapfhahn zauberer zeder zeitung zelle zepter zikade zinne zipfel zirbe zwilling acht ader
aster aue bad balg barsch bast batzen baude beule biege bier bims block borte bruch bund daune delle docke
dunst ecke egel eibe erle espe fell ferne flaum flecken flinte flug forke furt gaul gebet geck ginster gitter
glanz gnu graf grat greis grund gunst hacken hain hanf heim hydrant kaff karo kies kinn kladde klotz knall
knolle kogge krapfen kreisel kunde kurve lasur latz lehne leib lein leiste linsen lot lupine malve mark marsch
mast matsch maut meiler mergel mispel mohn molch mops mulch nehrung neffe nerz niete nobel oblate ode ort pech
pegel pfahl pfand pfeiler pflanze pirsch plombe pollen
`;

export default WORDS.trim().split(/\s+/);
