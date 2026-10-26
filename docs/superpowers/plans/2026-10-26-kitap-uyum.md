# Kitap v0.2 ile uyum — plan

Spec: `docs/superpowers/specs/2026-10-26-kitap-uyum-design.md`. Dal `feat/kitap-uyum`,
worktree `.worktrees/kitap-uyum`. Kitap kaynağı: `C:\projects\ModernVeriMadenGiris`
(`duzeltme/v0.2` dalı çalışma kopyasında), yalnızca okunur.

Her görevde: ilgili kitap bölümünü (`chapters/<alias>/content/final.md`) oku, sayıyı ve
ifadeyi oradan al; veri değişiyorsa `scripts/make_*_data.py` → yeniden üret; birim
testleri ve sayfanın e2e testini güncelle; `npx tsc --noEmit` + `npm test`; commit.

## Görev 1 — gradyan-artirma 5. adım (veri; gözden geçirilecek)

Kitap ch10'daki elle örnek: düzeltme `[1; 1]`, sonuç `[2,1; 4,1]`. Betik, veri, sahne
metni, birim test beklentileri, adım 5 e2e ve ekran görüntüsü.

## Görev 2 — ozellik-secimi son adım (veri; gözden geçirilecek)

Kitap ch04 blok 004: varyans filtresi `sabitDeger`'i atar, F-skorlarına göre k=2,
ölçekli RFE (`Pipeline` + `StandardScaler`) ve `SelectKBest` ikisi de
`musteriKidemAy`, `destekTaleplerinSayisi` seçer. Sayfanın RFE ve örtüşme adımı bu
sonuca getirilir; getirilemeyen fark "Kitapla farklar"a yazılır.

## Görev 3 — birliktelik-olculeri terimleri

Lift = "lift (ilgi oranı)" (ilk geçişte, sonra "lift"), leverage = "kaldıraç".
`registry.ts` başlığı "Destek, güven ve lift"; sayfa metinleri, sözlük/kartlar, README
kavram listesi, testlerdeki metin beklentileri. `apriori` sayfasında da aynı terim.

## Görev 4 — metin notları

iqr-aykiri Lab notu (kitap ch03 Şekil 3.2 ifadesi); bagging/random-forest süreleri
"yaklaşık"; dbscan "Kitapla farklar" (artık aynı veri) ve spec notu; dengesiz-veri /
smote-sizinti "Kitapla farklar" pozitif oran maddesi; duygu-analizi hata etiketi
"niyet hatası (hata vermez)" ve düzeltilmiş kod çıktısı (kitap ch12); model-kaymasi
`HataAyiklama.py` ve `# Sonuç:` (kitap ch14).

## Görev 5 — lime-yerel 8. adım

Sayfanın tohum kümesini kitap ch13 kod bloğuyla karşılaştır; fark tohum kümesindense
sayfa metninde tohum kümesini belirt; sayı yanlışsa betikten düzelt.

## Görev 6 — AGENTS.md ve kapı

AGENTS.md'deki iki "read-only" satırını güncelle (spec madde 11, İngilizce).
`npm run check` yeşil; değişen taban çizgileri yalnızca metni değişen adımlar.
