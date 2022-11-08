import { GREEN } from '../common/color';
import { VantComponent } from '../common/component';
import { useChildren } from '../common/relation';
import { getRect, isDef, getScrollOffset } from '../common/utils';

const indexList = () => {
  const indexList: string[] = [];
  const charCodeOfA = 'A'.charCodeAt(0);

  for (let i = 0; i < 26; i++) {
    indexList.push(String.fromCharCode(charCodeOfA + i));
  }

  return indexList;
};

VantComponent({
  relation: useChildren('index-anchor', function () {
    this.updateData();
  }),

  props: {
    sticky: {
      type: Boolean,
      value: true,
    },
    zIndex: {
      type: Number,
      value: 1,
    },
    highlightColor: {
      type: String,
      value: GREEN,
    },
    stickyOffsetTop: {
      type: Number,
      value: 0,
    },
    indexList: {
      type: Array,
      value: indexList(),
    },
  },

  data: {
    activeAnchorIndex: null,
    showSidebar: false,
  },

  methods: {
    updateData() {
      wx.nextTick(() => {
        if (this.timer != null) {
          clearTimeout(this.timer);
        }

        this.timer = setTimeout(() => {
          this.setData({
            showSidebar: !!this.children.length,
          });

          this.setRect().then(() => {
            this.changeActive();
          });
        }, 0);
      });
    },

    setRect() {
      return Promise.all([
        this.setAnchorsRect(),
        this.setListRect(),
        this.setSiderbarRect(),
      ]);
    },

    async setAnchorsRect() {
      const res = await getScrollOffset();
      return Promise.all(
        this.children.map((anchor) =>
          getRect(anchor, '.van-index-anchor-wrapper').then((rect) => {
            Object.assign(anchor, {
              height: rect.height,
              top: rect.top + res.scrollTop,
            });
          })
        )
      );
    },

    async setListRect() {
      const res = await getScrollOffset();
      return getRect(this, '.van-index-bar').then((rect) => {
        if (!isDef(rect)) {
          return;
        }
        Object.assign(this, {
          height: rect.height,
          top: rect.top + res.scrollTop,
        });
      });
    },

    setSiderbarRect() {
      return getRect(this, '.van-index-bar__sidebar').then((res) => {
        if (!isDef(res)) {
          return;
        }
        this.sidebar = {
          height: res.height,
          top: res.top,
        };
      });
    },

    setDiffData({ target, data }) {
      const diffData = {};

      Object.keys(data).forEach((key) => {
        if (target.data[key] !== data[key]) {
          diffData[key] = data[key];
        }
      });

      if (Object.keys(diffData).length) {
        target.setData(diffData);
      }
    },

    getAnchorRect(anchor) {
      return getRect(anchor, '.van-index-anchor-wrapper').then((rect) => ({
        height: rect.height,
        top: rect.top,
      }));
    },

    getActiveMargin(anchor) {
      return anchor.height * 1.5 + this.data.stickyOffsetTop;
    },

    changeActive() {
      const intersectionList: WechatMiniprogram.IntersectionObserverObserveCallbackResult[] =
        [];
      this.children.forEach((anchor, index) => {
        wx.createIntersectionObserver(anchor)
          .relativeToViewport({
            top: -this.getActiveMargin(anchor),
          })
          .observe('.van-index-anchor-wrapper', (res) => {
            intersectionList[index] = res;
            const active = this.getActiveAnchorIndex(intersectionList);
            this.setDiffData({
              target: this,
              data: {
                activeAnchorIndex: active,
              },
            });
            this.setStyle(active);
          });
      });
    },

    getActiveAnchorIndex(intersectionList) {
      const len = intersectionList.length;
      let active = -1;
      for (let i = 0; i < len; i++) {
        const item = intersectionList[i];
        const margin = this.getActiveMargin(this.children[i]);
        const nextMargin = this.getActiveMargin(this.children[i + 1]);
        if (!item) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const {
          boundingClientRect: { bottom },
        } = item;
        const {
          boundingClientRect: { bottom: nextBottom },
        } = intersectionList[i + 1] || { boundingClientRect: {} };
        if (i === 0) {
          if (bottom > margin) {
            break;
          }
        }

        if (bottom <= margin) {
          if (nextBottom > nextMargin) {
            active = i;
            break;
          }
          active = i;
        }
      }

      return active;
    },

    setStyle(active) {
      const { children } = this;
      const { sticky, stickyOffsetTop, zIndex, highlightColor } = this.data;
      if (sticky) {
        children.forEach((item, index) => {
          if (index === active) {
            let wrapperStyle = '';
            let anchorStyle = `
        color: ${highlightColor};
      `;

            wrapperStyle = `
          height: ${children[index].height}px;
        `;
            anchorStyle = `
          position: fixed;
          top: ${stickyOffsetTop}px;
          z-index: ${zIndex};
          color: ${highlightColor};
        `;
            this.setDiffData({
              target: item,
              data: {
                active: true,
                anchorStyle,
                wrapperStyle,
              },
            });
          } else if (index === active - 1) {
            const currentAnchor = children[index];
            const currentOffsetTop = currentAnchor.top;
            const targetOffsetTop =
              index === children.length - 1
                ? this.top
                : children[index + 1].top;
            const parentOffsetHeight = targetOffsetTop - currentOffsetTop;
            const translateY = parentOffsetHeight - currentAnchor.height;
            const anchorStyle = `
              position: relative;
              transform: translate3d(0, ${translateY}px, 0);
              z-index: ${zIndex};
              color: ${highlightColor};
            `;
            this.setDiffData({
              target: item,
              data: {
                active: true,
                anchorStyle,
              },
            });
          } else {
            this.setDiffData({
              target: item,
              data: {
                active: false,
                anchorStyle: '',
                wrapperStyle: '',
              },
            });
          }
        });
      }
    },

    onClick(event) {
      this.scrollToAnchor(event.target.dataset.index);
    },

    onTouchMove(event) {
      const sidebarLength = this.children.length;
      const touch = event.touches[0];
      const itemHeight = this.sidebar.height / sidebarLength;
      let index = Math.floor((touch.clientY - this.sidebar.top) / itemHeight);

      if (index < 0) {
        index = 0;
      } else if (index > sidebarLength - 1) {
        index = sidebarLength - 1;
      }

      this.scrollToAnchor(index);
    },

    onTouchStop() {
      this.scrollToAnchorIndex = null;
    },

    scrollToAnchor(index) {
      if (typeof index !== 'number' || this.scrollToAnchorIndex === index) {
        return;
      }

      this.scrollToAnchorIndex = index;

      const anchor = this.children.find(
        (item) => item.data.index === this.data.indexList[index]
      );

      if (anchor) {
        wx.pageScrollTo({
          scrollTop: anchor.top,
        });
        this.$emit('select', anchor.data.index);
      }
    },
  },
});
