export const APP_NAME = '声屿';
export const APP_NAME_EN = 'SONORA';

export const FALLBACK_TRACKS = [
  {
    id: '2078101758',
    source: 'netease',
    name: '时过境迁',
    artists: '苏艺馨Chency',
    album: '时过境迁',
    cover: 'https://p4.music.126.net/A5J9gFuJgfzqravyuj184g==/109951168881933739.jpg?param=600y600',
    duration: 269117,
  },
  {
    id: '1973665667',
    source: 'netease',
    name: '海屿你',
    artists: '马也_Crabbit',
    album: '海屿你',
    cover: 'https://p3.music.126.net/RfguLkQJ8aMVkiIaxdy70Q==/109951170483263672.jpg?param=600y600',
    duration: 295940,
  },
  {
    id: '1456890009',
    source: 'netease',
    name: '罗生门（Follow）',
    artists: '梨冻紧 / Wiz_H张子豪',
    album: '罗生门（Follow）',
    cover: 'https://p4.music.126.net/yN1ke1xYMJ718FiHaDWtYQ==/109951165076380471.jpg?param=600y600',
    duration: 243754,
  },
  {
    id: '287398',
    source: 'netease',
    name: '我不难过',
    artists: '孙燕姿',
    album: '未完成',
    cover: 'https://p4.music.126.net/Pzxy6py26NgNmhJjYMf2RQ==/109951169724216323.jpg?param=600y600',
    duration: 320400,
  },
  {
    id: '3456047164',
    source: 'netease',
    name: 'Hong Kong (feat. 王菲季候风)',
    artists: 'The Weeknd',
    album: 'Hong Kong (feat. 王菲季候风)',
    cover: 'https://p4.music.126.net/12-Tl1d-BT-_AwXMl7-MzQ==/109951174206326909.jpg?param=600y600',
    duration: 216993,
  },
  {
    id: '1303464858',
    source: 'netease',
    name: '于是',
    artists: '郑润泽',
    album: '于是',
    cover: 'https://p4.music.126.net/PEGvmO3OqgGOkx4m9qxAJA==/109951163478499713.jpg?param=600y600',
    duration: 232835,
  },
  {
    id: '167691',
    source: 'netease',
    name: '天龙八部之宿敌',
    artists: '许嵩',
    album: '天龙八部之宿敌',
    cover: 'https://p3.music.126.net/Ezo6K3rPFowvnkDtxf-w6Q==/109951172321459335.jpg?param=600y600',
    duration: 263340,
  },
  {
    id: '2741144144',
    source: 'netease',
    name: '99',
    artists: 'TizzyT',
    album: '99',
    cover: 'https://p3.music.126.net/D-kiZM7mbHrqdB6X8Yoi8Q==/109951171947326885.jpg?param=600y600',
    duration: 282188,
  },
  {
    id: '5257138',
    source: 'netease',
    name: '屋顶',
    artists: '周杰伦 / 温岚',
    album: '男女情歌对唱冠军全记录',
    cover: 'https://p2.music.126.net/81BsxxhomJ4aJZYvEbyPkw==/109951165671182684.jpg?param=600y600',
    duration: 292000,
  },
  {
    id: '186016',
    source: 'netease',
    name: '晴天',
    artists: '周杰伦',
    album: '叶惠美',
    cover: 'https://p1.music.126.net/6y-UleORIZEDsBSlFi9NMg==/109951169961199008.jpg?param=600y600',
    duration: 269000,
  },
];

export const SIDEBAR_PLAYLISTS = [
  {
    id: 'night-flight',
    title: '夜航星图',
    subtitle: '给凌晨两点的耳朵',
    query: '陈奕迅 月球上的人',
    gradient: 'linear-gradient(135deg, #2d4b4a 0%, #5d7b6e 55%, #c9a26b 100%)',
  },
  {
    id: 'city-walk',
    title: '城市漫游',
    subtitle: '在红灯前跳一支舞',
    query: '落日飞车 My Jinji',
    gradient: 'linear-gradient(135deg, #64372d 0%, #a35b45 55%, #e6b27d 100%)',
  },
  {
    id: 'rainy-room',
    title: '雨后房间',
    subtitle: '潮湿、安静、刚刚好',
    query: 'Laufey From The Start',
    gradient: 'linear-gradient(135deg, #303c54 0%, #5d6f8e 60%, #c5b7a0 100%)',
  },
];

export const MOODS = [
  { label: '全部', query: '' },
  { label: '华语流行', query: '华语流行' },
  { label: '独立民谣', query: '独立民谣' },
  { label: '电子氛围', query: '电子 氛围' },
  { label: '爵士夜色', query: '爵士' },
  { label: '复古摇滚', query: '摇滚' },
];

export const GENRES = [
  {
    title: '华语流行',
    subtitle: '熟悉的旋律，新的心动',
    query: '华语 流行',
    gradient: 'linear-gradient(135deg, #365c54 0%, #7c9f8b 100%)',
    emoji: '流',
  },
  {
    title: '电子',
    subtitle: '让节拍接管今晚',
    query: '电子 音乐',
    gradient: 'linear-gradient(135deg, #3f4b74 0%, #9b87b6 100%)',
    emoji: '电',
  },
  {
    title: '爵士',
    subtitle: '一杯酒，一段即兴',
    query: '爵士 女声',
    gradient: 'linear-gradient(135deg, #5e3f30 0%, #c08d62 100%)',
    emoji: '爵',
  },
  {
    title: '摇滚',
    subtitle: '把音量再拧大一点',
    query: '摇滚 乐队',
    gradient: 'linear-gradient(135deg, #653133 0%, #c56f62 100%)',
    emoji: '摇',
  },
  {
    title: '民谣',
    subtitle: '一把吉他和远方的风',
    query: '民谣 吉他',
    gradient: 'linear-gradient(135deg, #75663d 0%, #cab27b 100%)',
    emoji: '谣',
  },
  {
    title: '古典',
    subtitle: '把时间交给弦乐',
    query: '古典 钢琴',
    gradient: 'linear-gradient(135deg, #3a4a4a 0%, #a7a99a 100%)',
    emoji: '古',
  },
];

export const QUALITY_OPTIONS = [
  { value: '128', label: '标准', detail: '128 kbps' },
  { value: '192', label: '较高', detail: '192 kbps' },
  { value: '320', label: '极高', detail: '320 kbps' },
];

export const CHART_IDS = {
  hot: '3778678',
  fresh: '3779629',
  rising: '19723756',
};
