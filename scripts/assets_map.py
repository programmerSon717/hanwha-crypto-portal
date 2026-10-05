"""태그·헤드라인에서 '가상자산'을 뽑아내기 위한 사전.

쟁글 포탈의 최신정보 표에는 기사마다 가상자산 아이콘·이름이 붙는다.
한화 봇은 그 필드를 따로 저장하지 않으므로 해시태그와 제목에서 유추한다.
"""

# symbol -> (한글명, 색상)
ASSETS = {
    "BTC": ("비트코인", "#F7931A"), "ETH": ("이더리움", "#627EEA"),
    "XRP": ("엑스알피(리플)", "#23292F"), "SOL": ("솔라나", "#14F195"),
    "BNB": ("비앤비", "#F3BA2F"), "USDT": ("테더", "#26A17B"),
    "USDC": ("유에스디코인", "#2775CA"), "ADA": ("에이다", "#0033AD"),
    "DOGE": ("도지코인", "#C2A633"), "TRX": ("트론", "#EB0029"),
    "LINK": ("체인링크", "#2A5ADA"), "AVAX": ("아발란체", "#E84142"),
    "SUI": ("수이", "#4DA2FF"), "NEAR": ("니어프로토콜", "#111111"),
    "APT": ("앱토스", "#111111"), "ARB": ("아비트럼", "#28A0F0"),
    "OP": ("옵티미즘", "#FF0420"), "MATIC": ("폴리곤", "#8247E5"),
    "ATOM": ("코스모스", "#2E3148"), "DOT": ("폴카닷", "#E6007A"),
    "LTC": ("라이트코인", "#345D9D"), "BCH": ("비트코인캐시", "#8DC351"),
    "XLM": ("스텔라루멘", "#14B6E7"), "HBAR": ("헤데라", "#000000"),
    "ONDO": ("온도파이낸스", "#1B4ADD"), "ENA": ("에테나", "#1C1C1C"),
    "WLD": ("월드코인", "#3C3C3D"), "SAND": ("샌드박스", "#00ADEF"),
    "AXS": ("엑시인피니티", "#0055D5"), "SEI": ("세이", "#9E1F19"),
    "ZEC": ("지캐시", "#ECB244"), "HYPE": ("하이퍼리퀴드", "#97FCE4"),
    "PUMP": ("펌프닷펀", "#1BC47D"), "STX": ("스택스", "#FC6432"),
    "AAVE": ("에이브", "#B6509E"), "UNI": ("유니스왑", "#FF007A"),
    "QNT": ("퀀트", "#2E1A47"), "ZRO": ("레이어제로", "#000000"),
    "TON": ("톤코인", "#0098EA"), "KAIA": ("카이아", "#BFF009"),
    "ETF": ("ETF", "#6B5BFF"),
}

# 한글/영문 별칭 -> symbol
ALIAS = {
    "비트코인": "BTC", "bitcoin": "BTC", "btc": "BTC",
    "이더리움": "ETH", "ethereum": "ETH", "eth": "ETH", "이더": "ETH",
    "리플": "XRP", "엑스알피": "XRP", "xrp": "XRP",
    "솔라나": "SOL", "solana": "SOL", "sol": "SOL",
    "바이낸스코인": "BNB", "bnb": "BNB", "bnb체인": "BNB",
    "테더": "USDT", "usdt": "USDT", "usdc": "USDC", "서클": "USDC",
    "에이다": "ADA", "카르다노": "ADA", "도지코인": "DOGE", "도지": "DOGE",
    "트론": "TRX", "tron": "TRX", "체인링크": "LINK", "chainlink": "LINK",
    "아발란체": "AVAX", "수이": "SUI", "sui": "SUI", "니어": "NEAR",
    "앱토스": "APT", "아비트럼": "ARB", "옵티미즘": "OP", "폴리곤": "MATIC",
    "코스모스": "ATOM", "폴카닷": "DOT", "라이트코인": "LTC",
    "스텔라": "XLM", "헤데라": "HBAR", "온도파이낸스": "ONDO", "온도": "ONDO",
    "에테나": "ENA", "월드코인": "WLD", "샌드박스": "SAND",
    "엑시인피니티": "AXS", "세이": "SEI", "지캐시": "ZEC",
    "하이퍼리퀴드": "HYPE", "스택스": "STX", "에이브": "AAVE",
    "유니스왑": "UNI", "퀀트": "QNT", "레이어제로": "ZRO",
    "톤코인": "TON", "카이아": "KAIA", "클레이튼": "KAIA",
    "etf": "ETF",
}

# 자산이 아니라 '주제'로 떨어지는 경우 쓰는 가상 자산 묶음
TOPIC_FALLBACK = {
    "국내정책": ("정책", "#6B5BFF"), "US Policy": ("정책", "#6B5BFF"),
    "Japan Policy": ("정책", "#6B5BFF"), "Hong Kong Policy": ("정책", "#6B5BFF"),
    "Singapore Policy": ("정책", "#6B5BFF"), "UAE Policy": ("정책", "#6B5BFF"),
    "Vietnam Policy": ("정책", "#6B5BFF"), "해외정책": ("정책", "#6B5BFF"),
    "China": ("정책", "#6B5BFF"),
    "Korea Rates": ("매크로", "#FF7A45"), "US Rates": ("매크로", "#FF7A45"),
    "Korea Equities": ("증시", "#0ABF7F"), "US Equities": ("증시", "#0ABF7F"),
    "Global Macro": ("매크로", "#FF7A45"),
    "거래소이슈": ("거래소", "#FFB020"), "이슈": ("마켓", "#8E8E99"),
}


def detect(tags, headline, category):
    """(표시명, 심볼, 색상) 반환. 못 찾으면 카테고리 기반 묶음으로."""
    pool = [t.lower() for t in (tags or [])]
    for t in pool:
        sym = ALIAS.get(t)
        if sym:
            name, color = ASSETS[sym]
            return name, sym, color
    low = (headline or "").lower()
    for alias, sym in ALIAS.items():
        if alias in low:
            name, color = ASSETS[sym]
            return name, sym, color
    name, color = TOPIC_FALLBACK.get(category, ("마켓", "#8E8E99"))
    return name, "", color
