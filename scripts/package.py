import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


parser = argparse.ArgumentParser(description="打包同步采购扩展")
parser.add_argument("browser", choices=("chrome", "edge"), nargs="?", default="chrome")
args = parser.parse_args()

if args.browser == "edge":
    browser_name = "Microsoft Edge"
    extensions_page = "edge://extensions"
    developer_mode = "开发人员模式"
    load_unpacked = "加载解压缩"
    package_folder = "nju-purchase-sync-edge"
    instructions_url = "https://learn.microsoft.com/zh-cn/microsoft-edge/extensions/getting-started/extension-sideloading"
else:
    browser_name = "Chrome"
    extensions_page = "chrome://extensions"
    developer_mode = "开发者模式"
    load_unpacked = "加载已解压的扩展程序"
    package_folder = "nju-purchase-sync"
    instructions_url = "https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-an-unpacked-extension"

root = Path(__file__).resolve().parent.parent
extension = root / "extension"
manifest = json.loads((extension / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
files = {"manifest.json", manifest["background"]["service_worker"]}
for content_script in manifest["content_scripts"]:
    files.update(content_script["js"])
assert files == {path.name for path in extension.iterdir() if path.is_file()}

guide = f"""同步采购 · 南大试剂 v{version}

适合使用桌面版 {browser_name}、能登录南京大学试剂管理系统查看「我的订单」的同学。

安装步骤
1. 解压 ZIP，把解压出来的 {package_folder} 文件夹放在固定位置。
2. 在 {browser_name} 地址栏输入 {extensions_page}，打开「{developer_mode}」。
3. 点「{load_unpacked}」，选择含 manifest.json 的 {package_folder} 文件夹。
4. 用自己的账号登录南大试剂管理系统，打开或刷新「我的订单」。点击「导出」右侧的「同步采购」。

已安装旧版时，用新版文件覆盖原扩展文件夹。在扩展管理页点「重新加载」，再刷新「我的订单」。

订单页面
https://reagent.nju.edu.cn/labmai/cloudbean/personal/order

使用方法
点「同步本页」或「同步筛选范围全部页」同步订单，随后可查看采购明细、按品牌和 CAS 汇总，以及在浏览器里记录到货核对。
到货后，在「到货核对」勾选商品，点「准备入库」。核对实收瓶数，逐瓶填写产品编号，填写本批库存地或单瓶库存地，再生成并下载 .xls。
在 X-MOL 库存管理页点「导入」，上传文件。查看「库存导入记录」后，回插件打开「待确认入库」，勾选成功的瓶号并确认。部分成功时，可单独下载剩余瓶号。
在「采购明细」勾选要导出的商品，支持跨页选择。点「导出所选 .xls」生成按 X-MOL 模板排列的表格，CAS 号、品牌和包装规格分别填入 B、F、I 列。产品编号由你在表内补填。缺有效 CAS 的商品会用产品名称标识。
「订单导出」列显示下载完成的次数。同一次下载里，同一订单无论勾选几件商品都只加 1 次。旧版导出的商品可勾选后点「补记旧版导出」，同一订单最多补记 1 次。

安装包只包含扩展程序、空白 X-MOL 表格模板和此说明。订单台账、待确认批次、入库数量和导出次数保存在各自的 {browser_name} 浏览器中。扩展使用下载权限确认 .xls 是否下载完成。

{browser_name} 官方安装说明
{instructions_url}
"""

(root / "dist").mkdir(exist_ok=True)
archive_path = root / "dist" / f"nju-purchase-sync-{args.browser}-v{version}.zip"
guide_name = "安装说明.txt"
guide_bytes = guide.replace("\n", "\r\n").encode("utf-8-sig")
with ZipFile(archive_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name in sorted(files):
        archive.write(extension / name, f"{package_folder}/{name}")
    archive.writestr(guide_name, guide_bytes)

with ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {f"{package_folder}/{name}" for name in files} | {guide_name}
    for name in files:
        assert archive.read(f"{package_folder}/{name}") == (extension / name).read_bytes()
    assert archive.read(guide_name) == guide_bytes
    print(f"Verified v{version}: {len(files)} extension files and the installation guide.")
print(archive_path.as_posix())
