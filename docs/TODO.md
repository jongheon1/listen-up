# TODO: 세그먼트 시킹 정확도 개선

## 현재 상태

### 완료됨
- [x] `CLAUDE.md` — "5. Commit After Every Change" 섹션 추가
- [x] 문제 원인 분석 완료 (세그먼트 간 gap 없음 + 브라우저 시킹 부정확)
- [x] 해결 방안 설계 완료
- [x] `public-src/player.ts` L422, L455 — `+ 0.05` 하드코딩 오프셋 → `seekToSegment()`으로 대체 완료
- [x] 문장 세그먼테이션 버그 수정 — `buildSentenceSegments()`가 `transcription.text`(구두점 포함)를 사용하도록 변경
- [x] `CLAUDE.md` — "6. STT·문장 분리 수정 시 반드시 테스트" 섹션 추가

---

## 구현 계획

### Milestone 1: 프론트엔드 — 세그먼트 gap 정규화
- [x] `public-src/player.ts`에 `normalizeSegmentGaps()` 함수 추가
  - 연속 세그먼트의 `seg[i].end`를 `seg[i+1].start - 0.02`로 트리밍 (20ms gap)
  - 자연 gap이 이미 있으면 건드리지 않음
- [x] `init()` 함수에서 세그먼트 로드 직후 호출: `segments = normalizeSegmentGaps(stt.segments)`

### Milestone 2: 프론트엔드 — `seekToSegment()` 중앙화 함수
- [x] `seekToSegment(index, andPlay = true)` 함수 추가
  - `audio.pause()` → `currentTime` 설정 → `seeked` 이벤트 후 `play()` 패턴
  - `andPlay = false`이면 시킹만 하고 재생하지 않음 (auto-pause용)
- [x] 기존 8곳 시킹 코드를 `seekToSegment()` 호출로 리팩토링:
  - [x] `prevSegment()` — 현재 재생
  - [x] `prevSegment()` — 이전으로 이동
  - [x] `nextSegment()`
  - [x] `replaySegment()`
  - [x] `updateCurrentSegment()` auto-pause
  - [x] `updateCurrentSegment()` loop mode
  - [x] segment bar click — `+ 0.05` 제거
  - [x] subtitle row click — `+ 0.05` 제거

### Milestone 3: 백엔드 — STT 세그먼트 빌드 시 gap 보장
- [x] `src/stt/stt.service.ts`의 `buildSentenceSegments()` return 직전에 gap 정규화 로직 추가
  - 프론트엔드와 동일한 로직 (20ms gap)
  - 새 STT 데이터가 처음부터 gap을 갖도록 보장

### Milestone 4: 문장 세그먼테이션 버그 수정
- [x] `buildSentenceSegments()`에 `fullText` 파라미터 추가 — `transcription.text` 전달
- [x] word join 대신 구두점 포함된 `fullText`를 `sbd.sentences()`에 전달
- [x] `npm run build` 성공 확인

### Milestone 5: 검증
- [x] `npm run build:frontend` 빌드 성공
- [ ] 세그먼트 클릭 시 이전 문장 끝 안 들림
- [ ] 키보드 네비게이션 (prev/next/replay) 정상 동작
- [ ] Auto-pause 모드 정상 동작
- [ ] Loop 모드 정상 동작
- [ ] Seekbar 드래그 기존과 동일
- [ ] 실제 오디오로 STT 돌려서 문장이 여러 개로 정상 분리되는지 확인

### Milestone 6: 한국어 파일명 깨짐 수정
- [x] `files.controller.ts` — `diskStorage.filename` 콜백에서 `file.originalname`을 Latin-1 → UTF-8 디코딩
- [x] `files.controller.ts` — `fileFilter`에서도 동일하게 디코딩 후 확장자 검사
- [x] `files.service.ts` — `handleUpload()`에서 `originalName` 저장 시 디코딩된 값 사용
- [x] `npm run build` 성공 확인

### Milestone 7: 세그먼트 길이 정규화 — 너무 긴 문장 분할 & 너무 짧은 문장 병합
- [ ] **긴 문장 분할**: sbd가 하나의 문장으로 판별해도 너무 긴 경우 추가 분할
  - 말의 공백(pause) 기준: word timestamps 사이 gap이 일정 이상이면 분할 지점으로 사용
  - 쉼표 등 구두점을 보조 분할 지점으로 활용
  - 적정 세그먼트 길이 기준값 결정 필요 (예: 15초 또는 단어 수 기준)
- [ ] **짧은 문장 병합**: "OK", "Yes", "Yeah" 등 극히 짧은 문장은 인접 세그먼트와 병합
  - 기준값 결정 필요 (예: 2초 미만 또는 단어 3개 이하)
  - 앞/뒤 세그먼트 중 어느 쪽에 병합할지 판단 로직
- [ ] 기존 테스트 및 실제 오디오로 검증

---

## 기술 배경

**문제**: Whisper STT word-level timestamps → 문장 세그먼트 빌드 시 완전 연속 (seg0.end=4, seg1.start=4).
세그먼트 클릭으로 `audio.currentTime = seg.start` 시킹 시, 브라우저가 MP3 프레임 경계로 근사 시킹하여 이전 세그먼트 끝부분이 재생됨.

**해결 전략 (2계층 방어)**:
1. 데이터 레벨: 세그먼트 간 20ms gap 보장 (경계 모호성 제거)
2. 재생 레벨: pause → seek → `seeked` event → play 패턴 (브라우저 시킹 부정확 해결)

**주요 파일**:
- `public-src/player.ts` — 프론트엔드 플레이어 (핵심 수정 대상)
- `src/stt/stt.service.ts` — `buildSentenceSegments()` (백엔드 수정 대상)
- `public-src/types.ts` — `Segment` 인터페이스 (참조용)
