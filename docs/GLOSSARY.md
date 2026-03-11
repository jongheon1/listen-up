# Glossary — Listen-Up 용어집

프로젝트 내 기능, 화면 구성 요소, 도메인 개념의 공식 명칭 정의.
코드, 커밋 메시지, 이슈, 대화에서 이 용어를 사용한다.

---

## 화면 (Screens)

| 용어 | 설명 |
|------|------|
| **Library** | 메인 화면. 파일 목록, 업로드, 재생목록 관리를 포함 |
| **Player** | 재생 화면. 오디오 재생 + 자막 표시 + 편집 기능 |

---

## Player 구성 요소

### 상단 영역

| 용어 | 코드 클래스/ID | 설명 |
|------|---------------|------|
| **Top Bar** | `.top-bar` | 파일명, 뒤로가기, 토글 버튼들이 있는 상단 바 |
| **Back Button** | `#back-btn` | Library로 복귀하는 화살표 버튼 |
| **Edit Toggle** | `#edit-toggle` | 편집 모드 ON/OFF 버튼 |
| **AP Toggle** | `#ap-toggle` | Auto-Pause 토글. 문장 끝에서 자동 일시정지 |
| **Speed Display** | `#speed-display` | 재생 속도 표시 (클릭으로 순환) |

### 오디오 컨트롤

| 용어 | 코드 클래스/ID | 설명 |
|------|---------------|------|
| **Audio Bar** | `.audio-bar` | 재생/정지, 시크바, 시간, 볼륨이 있는 바 |
| **Play Button** | `#play-btn` | 재생/일시정지 토글 |
| **Seekbar** | `#seekbar` | 오디오 전체 타임라인 슬라이더 |
| **Volume** | `#volume` | 볼륨 슬라이더 |

### Segment Bar

| 용어 | 코드 클래스 | 설명 |
|------|------------|------|
| **Segment Bar** | `.segment-bar` | Seekbar 아래의 문장별 블록 타임라인 |
| **Segment Block** | `.seg-block` | 개별 세그먼트를 나타내는 블록. 너비 = 길이 비례. 클릭 시 해당 세그먼트로 이동 |
| **Segment Handle** | `.seg-handle` | 편집 모드에서 블록 사이의 드래그 핸들. 세그먼트 경계를 조정 |

### Subtitle Panel

| 용어 | 코드 클래스 | 설명 |
|------|------------|------|
| **Subtitle Panel** | `.subtitle-panel` | 자막 표시 영역 전체 |
| **Subtitle Row** | `.subtitle-row` | 한 세그먼트의 자막 행. 영어 + 한국어 + (편집 모드 시) 시간 정보 |
| **Sub-en** | `.sub-en` | 영어 원문 열 |
| **Sub-ko** | `.sub-ko` | 한국어 번역 열 |
| **Seg Time** | `.seg-time` | 편집 모드에서 세그먼트의 시작-끝 시간 레이블 |
| **Nudge Button** | `.nudge-btn` | `<` `>` 버튼. 세그먼트 시작 시간을 ±0.1초 미세 조정 |

### 하단 / 기타

| 용어 | 코드 클래스 | 설명 |
|------|------------|------|
| **Keyboard Help** | `.keyboard-help` | 단축키 안내 바 (편집 모드에서 숨김) |
| **Edit Actions** | `.edit-actions` | 편집 모드의 Cancel / Save 버튼 바 |
| **Toast** | `.toast` | 하단 중앙의 임시 알림 메시지 |

### Playlist Sidebar

| 용어 | 코드 클래스/ID | 설명 |
|------|---------------|------|
| **Playlist Sidebar** | `.playlist-sidebar` | Player 좌측의 접을 수 있는 재생목록 패널 |
| **Sidebar File** | `.sidebar-file` | 사이드바 내 개별 파일 항목 |

---

## Library 구성 요소

| 용어 | 코드 클래스 | 설명 |
|------|------------|------|
| **Upload Area** | `.upload-area` | 드래그 앤 드롭 파일 업로드 영역 |
| **Resume Banner** | `.resume-banner` | 최근 학습 파일 "이어서 듣기" 배너 |
| **File Table** | `.file-table` | 업로드된 파일 목록 테이블 |
| **STT Badge** | `.stt-badge` | STT 처리 상태 뱃지 (pending / processing / done / error) |
| **Playlist Entry** | `.playlist-entry` | 재생목록 항목. 펼치면 파일 리스트 표시 |

---

## 기능 (Features)

| 용어 | 설명 |
|------|------|
| **Auto-Pause (AP)** | 한 세그먼트 끝에서 자동으로 일시정지. 문장별 학습용 |
| **Loop** | 현재 세그먼트를 무한 반복 재생 (Shift+R) |
| **Replay** | 현재 세그먼트를 처음부터 다시 재생 (R) |
| **Translation Toggle** | 한국어 번역 열 숨기기/보이기 (Enter) |
| **Edit Mode** | 세그먼트 경계 시간을 조정하는 모드. Handle 드래그 + Nudge 버튼으로 조작 |
| **Nudge** | 편집 모드에서 세그먼트 start를 ±0.1초 단위로 미세 조정하는 동작 |
| **Progress Save** | 재생 위치를 10초마다 + 페이지 이탈 시 서버에 자동 저장 |

---

## 도메인 개념 (Data / Backend)

| 용어 | 설명 |
|------|------|
| **Segment** | STT로 분리된 하나의 문장 단위. `{ id, start, end, text, translation }` |
| **STT (Speech-to-Text)** | 오디오를 텍스트로 변환하는 처리. Whisper API 사용 |
| **Transcription** | STT 원시 결과. 단어별 타이밍 포함 |
| **Sentence Segmentation** | Whisper 결과를 문장 단위로 분리하는 후처리 |
| **Gap Normalization** | 인접 세그먼트 사이에 최소 20ms 간격을 유지하는 정규화 |
| **FileMeta** | 파일 메타데이터 (`id`, `originalName`, `duration`, `sttStatus`, ...) |
| **SttResult** | STT 처리 결과 (`segments[]`, `duration`) |
| **PlaylistMeta** | 재생목록 메타데이터 (`id`, `name`, `fileIds[]`) |
| **Progress** | 재생 진도 (`currentTime`, `segmentIndex`) |

---

## 단축키 용어

| 키 | 동작명 |
|----|--------|
| `←` / `→` | Prev / Next Segment |
| `Shift+←` / `Shift+→` | 5s Skip |
| `Space` | Toggle Play |
| `R` | Replay |
| `Shift+R` | Toggle Loop |
| `Enter` | Toggle Translation |
| `↑` / `↓` | Speed Up / Down |

---

## 시간 표기

| 형식 | 용도 | 예시 |
|------|------|------|
| `M:SS` | 재생 시간 표시 (Audio Bar) | `1:45` |
| `M:SS.S` | 세그먼트 시간 정밀 표시 (Edit Mode) | `1:45.2` |
| 초 (float) | 내부 데이터 / API | `105.2` |
