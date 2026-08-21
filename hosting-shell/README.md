Folder ini sengaja hampir kosong.

Situs Hosting `synaped` (https://synaped.web.app) tidak menyajikan aplikasi.
Tugasnya hanya satu: mengalihkan setiap permintaan ke backend App Hosting
di https://synaped--synap-ed.asia-southeast1.hosted.app.

Kenapa hanya pengalihan, bukan proxy?

Rencana awalnya memakai rewrite ke Cloud Run supaya aplikasinya benar-benar
tampil di synaped.web.app. Itu dicoba dan GAGAL dengan HTTP 403: service
Cloud Run milik App Hosting tidak punya binding IAM sama sekali, jadi hanya
edge internal App Hosting yang boleh memanggilnya. Memaksakannya berarti
memberi `allUsers` peran run.invoker pada resource yang dikelola Google —
bisa direset diam-diam setiap rollout, dan membuka URL run.app mentah ke
publik. Mendaftarkan synaped.web.app sebagai custom domain App Hosting juga
ditolak ("invalid domain name").

Jadi domain pendek ini adalah PINTU MASUK, bukan alamat aplikasi: pengunjung
mengetik synaped.web.app lalu mendarat di URL App Hosting. Untuk benar-benar
mengganti alamatnya, dibutuhkan domain sendiri yang dipasang sebagai custom
domain App Hosting.

Berkas ini hanya penanda supaya folder ikut terlacak git, dan dikecualikan
dari unggahan lewat "ignore" di firebase.json.
