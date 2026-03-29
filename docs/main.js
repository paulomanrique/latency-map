// ============================================================
//  LatencyMap — main2.js
//  Theme toggle + scroll animations + i18n (12 languages)
// ============================================================

// ---- Translations ----
const translations = {
  en: {
    'nav.features':      'Features',
    'nav.download':      'Download',
    'hero.h1':           'See where your<br>network <span class="word-accent">stands.</span>',
    'hero.p':            'Ping and traceroute to hundreds of cloud endpoints — natively, with no external binaries. Filter by location, sort by distance, then share the exact query and results with one link.',
    'hero.btn.download': 'Download free',
    'hero.btn.github':   'Source on GitHub',
    'features.label':    'What it does',
    'f1.name': 'Native Ping & Traceroute',
    'f1.desc': 'Executes OS-level ping and traceroute. No wrappers, no external binaries — raw system calls for accurate per-hop RTT and IP breakdowns.',
    'f2.name': 'Auto-Updating Catalog',
    'f2.desc': 'Provider endpoints refresh from the repository every launch. Always current without reinstalling.',
    'f3.name': 'Geo-Location Filtering',
    'f3.desc': 'Filter by continent, country, or city. Sort hosts by geographic distance from your coordinates.',
    'f4.name': 'Custom Hosts',
    'f4.desc': 'Add your own servers alongside cloud endpoints. Monitor everything from one place.',
    'f5.name': 'Quality Scoring',
    'f5.desc': 'Ping, packet loss, and jitter combine into a multi-tiered score. Spot bad connections instantly.',
    'f6.name': 'Shareable Snapshots',
    'f6.desc': 'Publish the current query and results to a public share link. Others get the same ranked view, traceroute detail, and visual layout instantly.',
    'cta.h2':  'Free. Open source.<br>Runs everywhere.',
    'cta.btn': 'Download Latest Release',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Releases',
    'footer.issues':     'Issues',
    'footer.contribute': 'Contribute',
    'footer.unlicense':  'Unlicense',
  },

  pt: {
    'nav.features':      'Funcionalidades',
    'nav.download':      'Download',
    'hero.h1':           'Veja onde sua<br>rede <span class="word-accent">está.</span>',
    'hero.p':            'Ping e traceroute para centenas de endpoints na nuvem — nativamente, sem binários externos. Filtre por localização, ordene por distância e compartilhe a consulta e os resultados exatos com um link.',
    'hero.btn.download': 'Download grátis',
    'hero.btn.github':   'Código no GitHub',
    'features.label':    'O que faz',
    'f1.name': 'Ping & Traceroute Nativo',
    'f1.desc': 'Executa ping e traceroute a nível de sistema operacional. Sem wrappers, sem binários externos — chamadas de sistema puras para RTT preciso por salto.',
    'f2.name': 'Catálogo com Atualização Automática',
    'f2.desc': 'Os endpoints dos provedores são atualizados do repositório a cada inicialização. Sempre atual sem reinstalar.',
    'f3.name': 'Filtro por Geolocalização',
    'f3.desc': 'Filtre por continente, país ou cidade. Ordene hosts por distância geográfica das suas coordenadas.',
    'f4.name': 'Hosts Personalizados',
    'f4.desc': 'Adicione seus próprios servidores ao lado dos endpoints na nuvem. Monitore tudo em um só lugar.',
    'f5.name': 'Pontuação de Qualidade',
    'f5.desc': 'Ping, perda de pacotes e jitter se combinam em uma pontuação multi-nível. Identifique conexões ruins instantaneamente.',
    'f6.name': 'Snapshots Compartilháveis',
    'f6.desc': 'Publique a consulta atual e os resultados em um link público. Quem abrir recebe a mesma lista ranqueada, o traceroute e o visual imediatamente.',
    'cta.h2':  'Gratuito. Código aberto.<br>Roda em todo lugar.',
    'cta.btn': 'Baixar Última Versão',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Versões',
    'footer.issues':     'Problemas',
    'footer.contribute': 'Contribuir',
    'footer.unlicense':  'Unlicense',
  },

  es: {
    'nav.features':      'Características',
    'nav.download':      'Descargar',
    'hero.h1':           'Mide la latencia<br>de tu <span class="word-accent">red.</span>',
    'hero.p':            'Ping y traceroute a cientos de endpoints en la nube — de forma nativa, sin binarios externos. Filtra por ubicación, ordena por distancia y comparte la consulta y los resultados exactos con un enlace.',
    'hero.btn.download': 'Descargar gratis',
    'hero.btn.github':   'Código en GitHub',
    'features.label':    'Qué hace',
    'f1.name': 'Ping y Traceroute Nativo',
    'f1.desc': 'Ejecuta ping y traceroute a nivel de SO. Sin wrappers, sin binarios externos — llamadas al sistema puras para RTT preciso por salto.',
    'f2.name': 'Catálogo con Actualización Automática',
    'f2.desc': 'Los endpoints de los proveedores se actualizan desde el repositorio en cada inicio. Siempre actualizado sin reinstalar.',
    'f3.name': 'Filtrado por Geolocalización',
    'f3.desc': 'Filtra por continente, país o ciudad. Ordena los hosts por distancia geográfica desde tus coordenadas.',
    'f4.name': 'Hosts Personalizados',
    'f4.desc': 'Añade tus propios servidores junto a los endpoints de la nube. Monitorea todo desde un solo lugar.',
    'f5.name': 'Puntuación de Calidad',
    'f5.desc': 'Ping, pérdida de paquetes y jitter se combinan en una puntuación multinivel. Detecta malas conexiones al instante.',
    'f6.name': 'Snapshots Compartibles',
    'f6.desc': 'Publica la consulta actual y los resultados en un enlace público. Quien lo abra ve el mismo ranking, el traceroute y el diseño al instante.',
    'cta.h2':  'Gratis. Código abierto.<br>Funciona en todas partes.',
    'cta.btn': 'Descargar Última Versión',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Versiones',
    'footer.issues':     'Problemas',
    'footer.contribute': 'Contribuir',
    'footer.unlicense':  'Unlicense',
  },

  de: {
    'nav.features':      'Funktionen',
    'nav.download':      'Herunterladen',
    'hero.h1':           'Messe die Latenz<br>deines <span class="word-accent">Netzwerks.</span>',
    'hero.p':            'Ping und Traceroute zu Hunderten von Cloud-Endpunkten — nativ, ohne externe Binärdateien. Nach Standort filtern, nach Entfernung sortieren und die exakte Abfrage samt Ergebnissen per Link teilen.',
    'hero.btn.download': 'Kostenlos herunterladen',
    'hero.btn.github':   'Quellcode auf GitHub',
    'features.label':    'Was es tut',
    'f1.name': 'Nativer Ping & Traceroute',
    'f1.desc': 'Führt Ping und Traceroute auf OS-Ebene aus. Keine Wrapper, keine externen Binärdateien — rohe Systemaufrufe für genaue RTT-Messungen pro Hop.',
    'f2.name': 'Automatisch aktualisierter Katalog',
    'f2.desc': 'Provider-Endpunkte werden bei jedem Start aus dem Repository aktualisiert. Immer aktuell ohne Neuinstallation.',
    'f3.name': 'Geo-Standort-Filterung',
    'f3.desc': 'Nach Kontinent, Land oder Stadt filtern. Hosts nach geografischer Entfernung von deinen Koordinaten sortieren.',
    'f4.name': 'Benutzerdefinierte Hosts',
    'f4.desc': 'Eigene Server neben Cloud-Endpunkten hinzufügen. Alles von einem Ort aus überwachen.',
    'f5.name': 'Qualitätsbewertung',
    'f5.desc': 'Ping, Paketverlust und Jitter ergeben eine mehrstufige Bewertung. Schlechte Verbindungen sofort erkennen.',
    'f6.name': 'Teilbare Snapshots',
    'f6.desc': 'Veröffentliche die aktuelle Abfrage und die Ergebnisse über einen öffentlichen Link. Andere sehen sofort dieselbe Rangliste, Traceroute-Details und Darstellung.',
    'cta.h2':  'Kostenlos. Open Source.<br>Läuft überall.',
    'cta.btn': 'Neueste Version herunterladen',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Versionen',
    'footer.issues':     'Fehler melden',
    'footer.contribute': 'Mitwirken',
    'footer.unlicense':  'Unlicense',
  },

  fr: {
    'nav.features':      'Fonctionnalités',
    'nav.download':      'Télécharger',
    'hero.h1':           'Mesurez la latence<br>de votre <span class="word-accent">réseau.</span>',
    'hero.p':            'Ping et traceroute vers des centaines d\'endpoints cloud — nativement, sans binaires externes. Filtrez par emplacement, triez par distance puis partagez la requête et les résultats exacts avec un lien.',
    'hero.btn.download': 'Télécharger gratuitement',
    'hero.btn.github':   'Code source sur GitHub',
    'features.label':    'Fonctionnalités',
    'f1.name': 'Ping & Traceroute Natif',
    'f1.desc': 'Exécute ping et traceroute au niveau du système. Sans wrappers, sans binaires externes — appels système bruts pour une mesure RTT précise par saut.',
    'f2.name': 'Catalogue mis à jour automatiquement',
    'f2.desc': 'Les endpoints des fournisseurs sont mis à jour depuis le dépôt à chaque lancement. Toujours à jour sans réinstallation.',
    'f3.name': 'Filtrage par géolocalisation',
    'f3.desc': 'Filtrez par continent, pays ou ville. Triez les hôtes par distance géographique depuis vos coordonnées.',
    'f4.name': 'Hôtes personnalisés',
    'f4.desc': 'Ajoutez vos propres serveurs aux côtés des endpoints cloud. Surveillez tout depuis un seul endroit.',
    'f5.name': 'Score de qualité',
    'f5.desc': 'Ping, perte de paquets et gigue se combinent en un score multiniveau. Détectez instantanément les mauvaises connexions.',
    'f6.name': 'Snapshots partageables',
    'f6.desc': 'Publiez la requête actuelle et les résultats via un lien public. Les autres voient instantanément le même classement, le traceroute et la même présentation.',
    'cta.h2':  'Gratuit. Open source.<br>Fonctionne partout.',
    'cta.btn': 'Télécharger la dernière version',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Versions',
    'footer.issues':     'Signaler un bug',
    'footer.contribute': 'Contribuer',
    'footer.unlicense':  'Unlicense',
  },

  nl: {
    'nav.features':      'Functies',
    'nav.download':      'Downloaden',
    'hero.h1':           'Meet de latentie<br>van uw <span class="word-accent">netwerk.</span>',
    'hero.p':            'Ping en traceroute naar honderden cloud-endpoints — native, zonder externe binaire bestanden. Filter op locatie, sorteer op afstand en deel vervolgens exact dezelfde query en resultaten met één link.',
    'hero.btn.download': 'Gratis downloaden',
    'hero.btn.github':   'Broncode op GitHub',
    'features.label':    'Wat het doet',
    'f1.name': 'Native Ping & Traceroute',
    'f1.desc': 'Voert ping en traceroute uit op OS-niveau. Geen wrappers, geen externe bestanden — ruwe systeemaanroepen voor nauwkeurige RTT-meting per hop.',
    'f2.name': 'Automatisch bijgewerkte catalogus',
    'f2.desc': 'Provider-endpoints worden bij elke start bijgewerkt vanuit de repository. Altijd actueel zonder herinstallatie.',
    'f3.name': 'Geo-locatiefiltering',
    'f3.desc': 'Filter op continent, land of stad. Sorteer hosts op geografische afstand van uw coördinaten.',
    'f4.name': 'Aangepaste hosts',
    'f4.desc': 'Voeg uw eigen servers toe naast cloud-endpoints. Bewaak alles vanuit één plek.',
    'f5.name': 'Kwaliteitsscore',
    'f5.desc': 'Ping, pakketverlies en jitter combineren tot een meervoudige score. Slechte verbindingen direct herkennen.',
    'f6.name': 'Deelbare snapshots',
    'f6.desc': 'Publiceer de huidige query en resultaten via een openbare link. Anderen zien direct dezelfde ranglijst, traceroute-details en weergave.',
    'cta.h2':  'Gratis. Open source.<br>Werkt overal.',
    'cta.btn': 'Nieuwste versie downloaden',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Versies',
    'footer.issues':     'Problemen melden',
    'footer.contribute': 'Bijdragen',
    'footer.unlicense':  'Unlicense',
  },

  ru: {
    'nav.features':      'Возможности',
    'nav.download':      'Скачать',
    'hero.h1':           'Измерьте задержку<br>вашей <span class="word-accent">сети.</span>',
    'hero.p':            'Ping и traceroute к сотням облачных эндпоинтов — нативно, без внешних бинарных файлов. Фильтруйте по местоположению, сортируйте по расстоянию и делитесь точным запросом и результатами по одной ссылке.',
    'hero.btn.download': 'Скачать бесплатно',
    'hero.btn.github':   'Исходный код на GitHub',
    'features.label':    'Возможности',
    'f1.name': 'Нативный Ping и Traceroute',
    'f1.desc': 'Выполняет ping и traceroute на уровне ОС. Без оберток, без внешних файлов — чистые системные вызовы для точного RTT по каждому узлу.',
    'f2.name': 'Автообновляемый каталог',
    'f2.desc': 'Эндпоинты провайдеров обновляются из репозитория при каждом запуске. Всегда актуально без переустановки.',
    'f3.name': 'Фильтрация по геолокации',
    'f3.desc': 'Фильтруйте по континенту, стране или городу. Сортируйте хосты по расстоянию от ваших координат.',
    'f4.name': 'Пользовательские хосты',
    'f4.desc': 'Добавляйте свои серверы рядом с облачными эндпоинтами. Отслеживайте всё из одного места.',
    'f5.name': 'Оценка качества',
    'f5.desc': 'Ping, потеря пакетов и джиттер объединяются в многоуровневую оценку. Мгновенно выявляйте плохие соединения.',
    'f6.name': 'Публичные снимки',
    'f6.desc': 'Публикуйте текущий запрос и результаты по публичной ссылке. Другие сразу увидят тот же рейтинг, traceroute и тот же визуальный вид.',
    'cta.h2':  'Бесплатно. Открытый код.<br>Работает везде.',
    'cta.btn': 'Скачать последнюю версию',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Релизы',
    'footer.issues':     'Сообщить об ошибке',
    'footer.contribute': 'Участвовать',
    'footer.unlicense':  'Unlicense',
  },

  sr: {
    'nav.features':      'Funkcije',
    'nav.download':      'Preuzmi',
    'hero.h1':           'Izmeri kašnjenje<br>vaše <span class="word-accent">mreže.</span>',
    'hero.p':            'Ping i traceroute do stotina cloud endpoint-a — nativno, bez eksternih fajlova. Filtrirajte po lokaciji, sortirajte po udaljenosti i podelite isti upit i rezultate jednim linkom.',
    'hero.btn.download': 'Preuzmi besplatno',
    'hero.btn.github':   'Izvorni kod na GitHub-u',
    'features.label':    'Šta radi',
    'f1.name': 'Nativni Ping i Traceroute',
    'f1.desc': 'Izvršava ping i traceroute na nivou OS-a. Bez omotača, bez eksternih fajlova — čisti sistemski pozivi za precizno RTT merenje po skoku.',
    'f2.name': 'Automatski ažurirani katalog',
    'f2.desc': 'Endpoint-i provajdera se ažuriraju iz repozitorijuma pri svakom pokretanju. Uvek aktuelno bez reinstalacije.',
    'f3.name': 'Filtriranje po geolokaciji',
    'f3.desc': 'Filtrirajte po kontinentu, zemlji ili gradu. Sortirajte hostove po geografskoj udaljenosti od vaših koordinata.',
    'f4.name': 'Prilagođeni hostovi',
    'f4.desc': 'Dodajte sopstvene servere pored cloud endpoint-a. Pratite sve sa jednog mesta.',
    'f5.name': 'Ocenjivanje kvaliteta',
    'f5.desc': 'Ping, gubitak paketa i džiter se kombinuju u višestepenu ocenu. Odmah uočite loše veze.',
    'f6.name': 'Deljivi snapshot-i',
    'f6.desc': 'Objavite trenutni upit i rezultate preko javnog linka. Drugi odmah dobijaju isti rangirani prikaz, traceroute detalje i isti izgled.',
    'cta.h2':  'Besplatno. Otvoreni kod.<br>Radi svuda.',
    'cta.btn': 'Preuzmi najnovije izdanje',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'Izdanja',
    'footer.issues':     'Prijavi grešku',
    'footer.contribute': 'Doprinesi',
    'footer.unlicense':  'Unlicense',
  },

  ar: {
    'nav.features':      'الميزات',
    'nav.download':      'تحميل',
    'hero.h1':           'اعرف أين تقف<br>شبكتك <span class="word-accent">الآن.</span>',
    'hero.p':            'أوامر Ping وTraceroute لمئات من نقاط النهاية السحابية — بشكل أصلي، دون ثنائيات خارجية. صفِّ حسب الموقع، ورتّب حسب المسافة، ثم شارك الاستعلام والنتائج نفسها عبر رابط واحد.',
    'hero.btn.download': 'تحميل مجاني',
    'hero.btn.github':   'الكود المصدري على GitHub',
    'features.label':    'ما يفعله',
    'f1.name': 'Ping وTraceroute الأصلي',
    'f1.desc': 'تنفيذ ping وtraceroute على مستوى نظام التشغيل. بدون أغلفة، بدون ثنائيات خارجية — استدعاءات نظام خام لقياس دقيق لـ RTT في كل نقطة.',
    'f2.name': 'كتالوج محدث تلقائياً',
    'f2.desc': 'نقاط نهاية المزودين تُحدَّث من المستودع عند كل تشغيل. دائماً محدثة دون إعادة التثبيت.',
    'f3.name': 'التصفية الجغرافية',
    'f3.desc': 'فلتر حسب القارة أو الدولة أو المدينة. رتب المضيفين حسب المسافة الجغرافية من إحداثياتك.',
    'f4.name': 'مضيفون مخصصون',
    'f4.desc': 'أضف خوادمك الخاصة جانباً لنقاط النهاية السحابية. راقب كل شيء من مكان واحد.',
    'f5.name': 'تقييم الجودة',
    'f5.desc': 'يتحد Ping وفقدان الحزم والـ jitter في درجة متعددة المستويات. اكشف الاتصالات السيئة فوراً.',
    'f6.name': 'لقطات قابلة للمشاركة',
    'f6.desc': 'انشر الاستعلام الحالي والنتائج عبر رابط عام. من يفتحه يرى نفس الترتيب، وتفاصيل traceroute، ونفس العرض فوراً.',
    'cta.h2':  'مجاني. مفتوح المصدر.<br>يعمل في كل مكان.',
    'cta.btn': 'تحميل أحدث إصدار',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'الإصدارات',
    'footer.issues':     'الإبلاغ عن مشكلة',
    'footer.contribute': 'المساهمة',
    'footer.unlicense':  'Unlicense',
  },

  zh: {
    'nav.features':      '功能',
    'nav.download':      '下载',
    'hero.h1':           '了解您网络的<br><span class="word-accent">延迟状况。</span>',
    'hero.p':            '对数百个云端点执行 Ping 和路由追踪 — 原生执行，无需外部二进制文件。按位置过滤，按距离排序，然后用一个链接分享完全相同的查询与结果。',
    'hero.btn.download': '免费下载',
    'hero.btn.github':   '在 GitHub 查看源码',
    'features.label':    '功能特性',
    'f1.name': '原生 Ping 和路由追踪',
    'f1.desc': '在操作系统级别执行 ping 和 traceroute。无需包装器，无需外部文件 — 使用原始系统调用进行精确的逐跳 RTT 测量。',
    'f2.name': '自动更新目录',
    'f2.desc': '每次启动时从仓库刷新提供商端点。无需重新安装即可始终保持最新。',
    'f3.name': '地理位置过滤',
    'f3.desc': '按大洲、国家或城市过滤。按与您坐标的地理距离排序主机。',
    'f4.name': '自定义主机',
    'f4.desc': '将您自己的服务器添加到云端点旁边。从一个地方监控所有内容。',
    'f5.name': '质量评分',
    'f5.desc': 'Ping、丢包率和抖动合并为多级评分。立即发现连接问题。',
    'f6.name': '可分享快照',
    'f6.desc': '将当前查询和结果发布为公开链接。其他人会立即看到相同的排序视图、traceroute 细节和界面布局。',
    'cta.h2':  '免费。开源。<br>跨平台运行。',
    'cta.btn': '下载最新版本',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   '版本',
    'footer.issues':     '反馈问题',
    'footer.contribute': '贡献代码',
    'footer.unlicense':  'Unlicense',
  },

  ja: {
    'nav.features':      '機能',
    'nav.download':      'ダウンロード',
    'hero.h1':           'ネットワークの<br>レイテンシを<span class="word-accent">測定する。</span>',
    'hero.p':            '数百のクラウドエンドポイントへの Ping と Traceroute をネイティブ実行。外部ファイル不要。場所で絞り込み、距離で並べ替え、さらに同じクエリと結果を1つのリンクで共有できます。',
    'hero.btn.download': '無料ダウンロード',
    'hero.btn.github':   'GitHub でソースを見る',
    'features.label':    '機能一覧',
    'f1.name': 'ネイティブ Ping & Traceroute',
    'f1.desc': 'OS レベルで ping と traceroute を実行。ラッパーなし、外部ファイルなし — ホップごとの正確な RTT 測定のための生のシステムコール。',
    'f2.name': '自動更新カタログ',
    'f2.desc': 'プロバイダーのエンドポイントは起動のたびにリポジトリから更新。再インストールなしで常に最新。',
    'f3.name': '地理的位置によるフィルタリング',
    'f3.desc': '大陸、国、都市でフィルタリング。座標からの地理的距離でホストをソート。',
    'f4.name': 'カスタムホスト',
    'f4.desc': 'クラウドエンドポイントと並んで独自のサーバーを追加。すべてを一か所から監視。',
    'f5.name': '品質スコアリング',
    'f5.desc': 'Ping、パケットロス、ジッターが多段階スコアに統合。悪い接続を即座に発見。',
    'f6.name': '共有スナップショット',
    'f6.desc': '現在のクエリと結果を公開リンクとして共有。開いた相手は同じランキング表示、Traceroute 詳細、同じレイアウトをすぐ確認できます。',
    'cta.h2':  '無料。オープンソース。<br>どこでも動く。',
    'cta.btn': '最新リリースをダウンロード',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   'リリース',
    'footer.issues':     '問題を報告',
    'footer.contribute': '貢献する',
    'footer.unlicense':  'Unlicense',
  },

  ko: {
    'nav.features':      '기능',
    'nav.download':      '다운로드',
    'hero.h1':           '네트워크 지연 시간을<br><span class="word-accent">확인하세요.</span>',
    'hero.p':            '수백 개의 클라우드 엔드포인트에 대한 Ping과 Traceroute를 네이티브로 실행합니다. 외부 파일 없이 위치로 필터링하고 거리로 정렬한 뒤, 같은 쿼리와 결과를 링크 하나로 공유할 수 있습니다.',
    'hero.btn.download': '무료 다운로드',
    'hero.btn.github':   'GitHub에서 소스 보기',
    'features.label':    '기능',
    'f1.name': '네이티브 Ping & Traceroute',
    'f1.desc': 'OS 레벨에서 ping과 traceroute 실행. 래퍼 없음, 외부 파일 없음 — 정확한 홉별 RTT 측정을 위한 원시 시스템 호출.',
    'f2.name': '자동 업데이트 카탈로그',
    'f2.desc': '공급자 엔드포인트는 매번 실행 시 저장소에서 새로 고침. 재설치 없이 항상 최신 상태.',
    'f3.name': '지리적 위치 필터링',
    'f3.desc': '대륙, 국가 또는 도시별로 필터링. 좌표에서 지리적 거리로 호스트 정렬.',
    'f4.name': '사용자 정의 호스트',
    'f4.desc': '클라우드 엔드포인트와 함께 자신의 서버를 추가. 한 곳에서 모든 것을 모니터링.',
    'f5.name': '품질 점수',
    'f5.desc': 'Ping, 패킷 손실 및 지터가 다단계 점수로 결합. 나쁜 연결을 즉시 발견.',
    'f6.name': '공유 가능한 스냅샷',
    'f6.desc': '현재 쿼리와 결과를 공개 링크로 게시합니다. 다른 사람도 같은 순위 보기, traceroute 세부 정보, 동일한 레이아웃을 바로 확인할 수 있습니다.',
    'cta.h2':  '무료. 오픈 소스.<br>어디서나 실행됩니다.',
    'cta.btn': '최신 릴리스 다운로드',
    'cta.sub': 'Windows · macOS · Linux · Unlicense',
    'footer.releases':   '릴리스',
    'footer.issues':     '문제 보고',
    'footer.contribute': '기여하기',
    'footer.unlicense':  'Unlicense',
  },
};

// RTL languages
const RTL_LANGS = new Set(['ar']);

// Language display labels
const LANG_LABELS = {
  en: 'EN', pt: 'PT', es: 'ES', de: 'DE', fr: 'FR', nl: 'NL',
  ru: 'RU', sr: 'SR', ar: 'AR', zh: '中文', ja: 'JA', ko: 'KO',
};

// ---- Detect preferred language ----
function detectLang() {
  const saved = localStorage.getItem('lang');
  if (saved && translations[saved]) return saved;

  const preferred = (navigator.languages || [navigator.language || 'en']);
  for (const l of preferred) {
    const code = l.split('-')[0].toLowerCase();
    if (translations[code]) return code;
  }
  return 'en';
}

// ---- Apply translations ----
function applyLang(lang) {
  const t = translations[lang] || translations.en;
  const html = document.documentElement;

  // text nodes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // html nodes (contain markup like <br> or <span>)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // RTL
  html.setAttribute('dir', RTL_LANGS.has(lang) ? 'rtl' : 'ltr');
  html.setAttribute('lang', lang);

  // Update label in button
  const label = document.getElementById('lang-label');
  if (label) label.textContent = LANG_LABELS[lang] || lang.toUpperCase();

  // Mark active option
  document.querySelectorAll('.lang-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  localStorage.setItem('lang', lang);
}

// ---- Language selector ----
function initLangSelector() {
  const selector = document.getElementById('lang-selector');
  const btn      = document.getElementById('lang-btn');
  const menu     = document.getElementById('lang-menu');
  if (!selector || !btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  menu.addEventListener('click', (e) => {
    const opt = e.target.closest('.lang-opt');
    if (!opt) return;
    applyLang(opt.dataset.lang);
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('click', () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
}

// ---- Theme toggle ----
function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const html   = document.documentElement;

  const saved  = localStorage.getItem('theme');
  const dark   = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  html.setAttribute('data-theme', saved || (dark ? 'dark' : 'light'));

  toggle?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

// ---- Scroll animations ----
function initScroll() {
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        o.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.scroll-animate').forEach(el => obs.observe(el));
}

// ---- Sticky header ----
function initHeader() {
  const header = document.getElementById('header');
  const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initScroll();
  initHeader();
  initLangSelector();
  applyLang(detectLang());
});
