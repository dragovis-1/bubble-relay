# bubble-relay

버블아케이드 온라인 대전용 중계 서버. 4자리 방 코드로 최대 4명을 묶어 주고 메시지만 전달한다.
게임 계산은 방장 기기가 하고 나머지는 입력을 보내고 화면 상태를 받는다.

## 배포 (Render)
1. Render → New → Web Service → 이 저장소 선택
2. Runtime: Node, Build: `npm install`, Start: `npm start`, Region: Singapore, Plan: Free
3. 배포 후 주소 `https://<서비스이름>.onrender.com` 을 열어 `BUBBLE ARCADE relay OK` 가 보이면 정상
4. 게임 설정에는 `wss://<서비스이름>.onrender.com` 을 넣는다

무료 플랜은 15분 동안 접속이 없으면 잠들고, 다음 접속 때 깨어나는 데 30초~1분 걸린다.

## 메시지
- 보내기: `create {name, char}`, `join {code, name, char}`, `char {char}`, `start`, `lobbyback`, `ping`
- 받기: `joined {code, id, host}`, `lobby {host, players, started}`, `left {id}`, `closed`, `error {msg}`
- 그 밖의 메시지는 같은 방에 그대로 전달 (`to`가 있으면 그 사람에게만, `from`이 붙는다)
