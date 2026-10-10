<?php
/** Лента таба с её поп-апами — и на странице, и во фрагменте для переключения без перезагрузки. */
$blocks = root_blocks($tab['id']);
$prev = feed($tab['id']);
echo view('blocks', ['blocks' => $blocks]);
echo view('popups', ['blocks' => $blocks, 'open' => $popup, 'pageUrl' => url('/' . $tab['slug'])]);
feed($prev);
