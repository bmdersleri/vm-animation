# VM Animasyon

Veri madenciliği kavramlarını adım adım animasyonlarla anlatan, ders sırasında kullanılmak üzere hazırlanmış statik bir Türkçe öğretim sitesi. İlk kavram: **k-En Yakın Komşu (k-NN)**.

İçerik, "Modern Veri Madenciliğine Giriş" kitabına (Prof. Dr. İsmail KIRBAŞ) dayanır.

## Canlı site

- Ana sayfa: https://bmdersleri.github.io/vm-animation/
- k-NN: https://bmdersleri.github.io/vm-animation/knn/
- Ders modu: https://bmdersleri.github.io/vm-animation/knn/?mod=ders

Site, GitHub Pages etkinleştirildiğinde (Settings > Pages > Source: GitHub Actions) `main` dalına her push ile yayına girer. GitHub Actions yalnızca derleyip yayınlar; testler yerelde çalışır. `npm ci` bir push öncesi kancası (`.githooks/pre-push`) kurar: `main`'e her push'tan önce `npm run check` kendiliğinden çalışır ve geçmezse push durur.

## Ders modu

Herhangi bir kavram sayfasına `?mod=ders` eklemek, sınıfta projeksiyon için tasarlanmış ders modunu açar.

## Klavye kısayolları

| Tuş | İşlev |
| --- | --- |
| → / Boşluk | Sonraki adım |
| ← | Önceki adım |
| P | Oynat / duraklat |
| F | Tam ekran |
| Home / End | İlk / son adım |
| ? | Yardım |
| + / - | k-NN: k değerini artır / azalt |
| M | k-NN: Öklid / Manhattan |
| S | k-NN: ölçekleme |
| D | k-NN: veri seti |
| B | k-NN: karar bölgeleri |

## Yerel geliştirme

```bash
npm ci
npm run dev        # geliştirme sunucusu
npm test           # birim testleri
npm run build      # tip denetimi + üretim derlemesi (dist/)
npm run test:e2e   # Playwright; Google Chrome kurulu olmalı
npm run check      # yayın öncesi kapı: birim testleri + derleme + Playwright
```

## Veriyi yeniden üretme

```bash
pip install -r scripts/requirements.txt
python scripts/make_knn_data.py <csv yolu>
```

## Yeni kavram ekleme

1. İskeleti üretin: `npm run yeni-kavram -- <kimlik> "<Başlık>"`. Betik `<kimlik>/index.html`, `src/concepts/<kimlik>/` (`main.ts`, `scenario.ts`, `<kimlik>.css`), birim ve e2e test dosyalarını oluşturur ve `vite.config.ts` girdisini ekler.
2. `main.ts` içindeki `ConceptPage` (bkz. `src/core/shell.ts`) sahnesini, parametrelerini ve senaryosunu doldurun.
3. `src/concepts/registry.ts` içinde ilgili kaydı `hazir` durumuna çevirip `href` değerini verin.
