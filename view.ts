import Dangling from "./Dangling.svelte"
import { ItemView, WorkspaceLeaf, TFile, CachedMetadata, MarkdownView, getLinkpath } from 'obsidian';
import { VIEW_TYPE_DANGLING_LINKS } from "./constants"
import Dangle from "./dangle"

export default class DanglingLinksView extends ItemView {
    private dangling: Dangling;

	constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.redraw = this.redraw.bind(this);
        this.visitDangle = this.visitDangle.bind(this);
        this.registerEvent(this.app.metadataCache.on("resolved", this.redraw));
        this.registerEvent(this.app.metadataCache.on("changed", this.redraw));
	}

    getViewType(): string {
		return VIEW_TYPE_DANGLING_LINKS;
	}

    getDisplayText(): string {
        return "Dangling links";
    }

    getIcon(): string {
        return "broken-link";
	}

	onClose(): Promise<void> {
		if (this.dangling) {
		  this.dangling.$destroy();
		}
		return Promise.resolve();
    }

    visitDangle(path: string, dangle: Dangle)
    {
        let file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile)
        {
            let leaf:WorkspaceLeaf = this.app.workspace.getUnpinnedLeaf();
            leaf.openFile(file).then(() => {
                if (leaf.view instanceof MarkdownView)
                {
                    this.app.workspace.setActiveLeaf(leaf, true, true);
                    leaf.view.editor.setCursor(dangle.line, dangle.col);                                                  
                }
            });
        }
    }

	async onOpen(): Promise<void> {
        let filesWithDangles = this.getDanglingLinks();
		this.dangling = new Dangling({
			target: (this as any).contentEl,
            props: { visitDangle: this.visitDangle,
                     filesWithDangles }
		  });
    }

    getDanglingLinks(): Map<string, Dangle[]> {
        // const con = require('electron').remote.getGlobal('console')

        let danglingLinks: Map<string, Dangle[]> = new Map();
        for (let file of this.app.vault.getMarkdownFiles()) {
            let meta:CachedMetadata = this.app.metadataCache.getFileCache(file);
            let dangles: Dangle[] = [];
            if (meta.links) {
                for (let link of meta.links) {

                    // Change `SomeTargetFile#Heading` => `SomeTargetFile`
                    let linkPath = getLinkpath(link.link);

                    // Try to resolve `SomeTargetFile` from context of file.path
                    let target:TFile = this.app.metadataCache
                                           .getFirstLinkpathDest(linkPath,
                                                                 file.path)

                    //con.log(`examining link ${link.link} in ${file.path}`);
                    if (target == null)
                    {
                        // con.log(`found dangling link ${link.link} in ${file.path}`);
                        dangles.push(new Dangle(link.link, link.position.start.line,
                                                link.position.start.col));
                    }
                }
            }
            if (dangles.length != 0)
            {
                // con.log(`adding ${dangles.length} dangling links for ${file.path}`);
                danglingLinks.set(file.path, dangles);
            }
        }
        return danglingLinks;
    }

    getSecond() {
        return (new Date().getTime() / 1000);
    }

	public async redraw(): Promise<void> {
        let filesWithDangles = this.getDanglingLinks();
        this.dangling.$set({ filesWithDangles });
	  }
}
