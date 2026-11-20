<template>
  <div class="email-list-box">
    <emailScroll ref="sysEmailScroll"
                 :get-emailList="getEmailList"
                 :email-delete="allEmailDelete"
                 :star-add="starAdd"
                 :star-cancel="starCancel"
                 :show-star="false"
                 show-user-info
                 show-status
                 actionLeft="4px"
                 :show-account-icon="false"
                 @jump="jumpContent"
                 @refresh-before="refreshBefore"
                 :type="'all-email'"

    >
      <template #first>
        <el-input
            v-model="searchValue"
            :placeholder="$t('searchByContent')"
            class="search-input"
            @keyup.enter="search"
        >
          <template #prefix>
            <div @click.stop="openSelect">
              <el-select
                  ref="mySelect"
                  v-model="params.searchType"
                  :placeholder="$t('select')"
                  class="select"
              >
                <el-option key="3" :label="$t('sender')" :value="'name'"/>
                <el-option key="4" :label="$t('subject')" :value="'subject'"/>
                <el-option key="1" :label="$t('user')" :value="'user'"/>
                <el-option key="2" :label="$t('selectEmail')" :value="'account'"/>
              </el-select>
              <div class="search-type">
                <span>{{ selectTitle }}</span>
                <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
              </div>
            </div>
          </template>
        </el-input>
        <el-select v-model="params.type" placeholder="Select" class="status-select" @change="typeSelectChange">
          <el-option key="1" :label="$t('all')" value="all"/>
          <el-option key="3" :label="$t('received')" value="receive"/>
          <el-option key="2" :label="$t('sent')" value="send"/>
          <el-option key="4" :label="$t('selectDeleted')" value="delete"/>
          <el-option key="5" :label="$t('noRecipientTitle')" value="noone"/>
        </el-select>
        <Icon class="icon" icon="iconoir:search" @click="search" width="20" height="20"/>
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
              v-if="params.timeSort === 0" width="28" height="28"/>
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
              width="28" height="28"/>
        <el-tooltip :content="t('filterMail')">
          <el-button :type="hasAdvancedFilters ? 'primary' : 'default'" size="small"
                     :aria-label="t('filterMail')" @click="openFilters">
            <Icon icon="mdi:filter-variant" width="18" height="18"/>
          </el-button>
        </el-tooltip>
        <span v-if="canDeleteFiltered" v-perm="'all-email:delete'">
          <el-tooltip :content="t('deleteFilteredMail')">
            <el-button type="danger" plain size="small" :aria-label="t('deleteFilteredMail')"
                       :loading="clearLoading" @click="deleteFiltered">
              <Icon icon="fluent:broom-sparkle-16-regular" width="18" height="18"/>
            </el-button>
          </el-tooltip>
        </span>
      </template>
    </emailScroll>
    <el-dialog v-model="showFilters" :title="t('filterMail')" width="min(360px, 92vw)">
      <div class="clear-email">
        <el-input v-model.trim="filterDraft.sendName" :placeholder="t('sender')" clearable/>
        <el-input v-model.trim="filterDraft.filterSubject" :placeholder="t('subject')" clearable/>
        <el-input v-model.trim="filterDraft.sendEmail" :placeholder="t('sendEmailAddress')" clearable/>
        <el-input v-model.trim="filterDraft.toEmail" :placeholder="t('toEmail')" clearable/>
        <el-date-picker popper-class="my-date-picker" v-model="filterDraft.dateRange"
                        type="daterange" :teleported="false" unlink-panels
                        :range-separator="t('to')" :start-placeholder="t('mailFilterDateStart')"
                        :end-placeholder="t('mailFilterDateEnd')"/>
        <el-form-item :label="t('mailFilterStar')">
          <el-select v-model="filterDraft.starred">
            <el-option :label="t('all')" value="all"/>
            <el-option :label="t('starred')" value="yes"/>
            <el-option :label="t('mailFilterUnstarred')" value="no"/>
          </el-select>
        </el-form-item>
        <el-form-item :label="t('mailFilterMatch')">
          <el-select v-model="filterDraft.matchType">
            <el-option :label="t('equal')" value="eq"/>
            <el-option :label="t('leading')" value="left"/>
            <el-option :label="t('include')" value="include"/>
          </el-select>
        </el-form-item>
      </div>
      <template #footer>
        <el-button @click="resetFilters">{{ t('resetMailFilters') }}</el-button>
        <el-button type="primary" @click="applyFilters">{{ t('applyMailFilters') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import {starAdd, starCancel} from "@/request/star.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {computed, defineOptions, reactive, ref, watch} from "vue";
import {useEmailStore} from "@/store/email.js";
import {
  allEmailList,
  allEmailDelete,
  allEmailBatchDelete
} from "@/request/all-email.js";
import {Icon} from "@iconify/vue";
import router from "@/router/index.js";
import {useI18n} from 'vue-i18n';
import {toUtc} from "@/utils/day.js";
import dayjs from "dayjs";

defineOptions({
  name: 'all-email'
})

const {t} = useI18n();
const emailStore = useEmailStore();
const sysEmailScroll = ref({})
const searchValue = ref('')
const mySelect = ref()
const showFilters = ref(false)
const clearLoading = ref(false)

const openSelect = () => {
  mySelect.value.toggleMenu()
}

const params = reactive({
  timeSort: 0,
  type: 'receive',
  userEmail: null,
  accountEmail: null,
  name: null,
  subject: null,
  searchType: 'name'
})

const defaultFilters = {
  filterSubject: '',
  sendEmail: '',
  sendName: '',
  toEmail: '',
  dateRange: null,
  starred: 'all',
  matchType: 'eq',
}
const filters = ref({...defaultFilters})
const filterDraft = reactive({...defaultFilters})
const hasAdvancedFilters = computed(() => {
  const {filterSubject, sendEmail, sendName, toEmail, dateRange, starred} = filters.value
  return Boolean(filterSubject || sendEmail || sendName || toEmail || dateRange || starred !== 'all')
})
const canDeleteFiltered = computed(() => filters.value.starred !== 'yes' &&
    (hasAdvancedFilters.value || params.userEmail || params.accountEmail || params.name || params.subject ||
        ['send', 'delete', 'noone'].includes(params.type)))

function currentFilters() {
  const {dateRange, ...advanced} = filters.value
  const startTime = dateRange ? toUtc(dateRange[0]).format('YYYY-MM-DD HH:mm:ss') : ''
  const endTime = dateRange ? toUtc(dayjs(dateRange[1]).add(1, 'day')).format('YYYY-MM-DD HH:mm:ss') : ''
  return {...params, ...advanced, startTime, endTime}
}

const selectTitle = computed(() => {
  if (params.searchType === 'user') return t('user')
  if (params.searchType === 'account') return t('selectEmail')
  if (params.searchType === 'name') return t('sender')
  if (params.searchType === 'subject') return t('subject')
})

const paramsStar = localStorage.getItem('all-email-params')
if (paramsStar) {
  const locaParams = JSON.parse(paramsStar)
  params.type = locaParams.type
  params.timeSort = locaParams.timeSort
  params.searchType = locaParams.searchType
}

watch(() => params, () => {
  localStorage.setItem('all-email-params', JSON.stringify(params))
}, {
  deep: true
})

function openFilters() {
  Object.assign(filterDraft, filters.value)
  showFilters.value = true
}

function resetFilters() {
  Object.assign(filterDraft, defaultFilters)
}

function applyFilters() {
  filters.value = {...filterDraft}
  showFilters.value = false
  search()
}

async function deleteFiltered() {
  if (!canDeleteFiltered.value || clearLoading.value) return
  const criteria = {...currentFilters(), scope: 'filtered'}
  clearLoading.value = true
  let confirmed = false
  let total = 0
  try {
    await ElMessageBox.confirm(t('deleteFilteredMailConfirm'), {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      type: 'warning',
    })
    confirmed = true

    let beforeId
    do {
      const batch = await allEmailBatchDelete({...criteria, beforeId})
      total += batch.deleted
      beforeId = batch.nextBeforeId
    } while (beforeId)
    ElMessage.success(t('deletedFilteredMailCount', {count: total}))
  } catch {
    if (total) ElMessage.warning(t('partialFilteredMailCount', {count: total}))
  } finally {
    clearLoading.value = false
    if (confirmed) sysEmailScroll.value?.refreshList()
  }
}

function refreshBefore() {
  searchValue.value = null
  filters.value = {...defaultFilters}
  params.timeSort = 0
  params.type = 'receive'
  params.userEmail = null
  params.accountEmail = null
  params.name = null
  params.subject = null
  params.searchType = 'name'
}

function search() {

  params.userEmail = null
  params.accountEmail = null
  params.name = null
  params.subject = null

  if (params.searchType === 'user') {
    params.userEmail = searchValue.value?.trim()
  }

  if (params.searchType === 'account') {
    params.accountEmail = searchValue.value?.trim()
  }

  if (params.searchType === 'name') {
    params.name = searchValue.value?.trim()
  }

  if (params.searchType === 'subject') {
    params.subject = searchValue.value?.trim()
  }

  sysEmailScroll.value.refreshList();
}

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  search()
}

function typeSelectChange() {
  search()
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'physics'
  emailStore.contentData.showStar = false
  emailStore.contentData.showReply = false
  router.push({name: 'content'})
}


function getEmailList(emailId, size) {
  return allEmailList({emailId, size, ...currentFilters()})
}
</script>
<style>

@media (max-width: 767px) {
  .el-date-range-picker .el-picker-panel__body {
    min-width: auto;

  }

  .my-date-picker::after {
    content: "";
    position: absolute; /* 脱离文档流，不会撑开 */
    left: 0;
    right: 0;
    height: 20px;
    background: transparent; /* 方便看效果 */
  }

  .el-date-range-picker__content {
    width: 100%;
  }

  .el-date-range-picker {
    width: 300px;
  }

  .el-tooltip .el-picker_popper {
    padding-bottom: 200px;
  }

  .el-date-range-picker__content.is-left {
    border-right: 0;
  }
}

</style>
<style scoped lang="scss">
.email-list-box {
  height: 100%;
  width: 100%;
  overflow: hidden;
}


.search {
  padding-top: 5px;
  padding-bottom: 5px;
}

.select {
  position: absolute;
  width: 40px;
  opacity: 0;
  pointer-events: none;
}

.search-type {
  display: flex;
  color: var(--el-text-color-regular);
}

:deep(.header-actions) {
  padding-top: 8px;
  padding-bottom: 8px;
}

.search-input {
  width: 100%;
  max-width: 280px;
  height: 28px;

  .setting-icon {
    position: relative;
    top: 3px;
  }
}

.clear-email {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.status-select {
  margin-bottom: 2px;
  width: 102px;

  :deep(.el-select__wrapper) {
    min-height: 28px;
  }
}

.input-with-select {
  max-width: 200px;
  border-radius: 0 4px 4px 0;
}

:deep(.input-with-select .el-input-group__append) {
  background-color: var(--el-fill-color-blank);
}

:deep(.el-select__wrapper) {
  padding: 2px 10px;
  min-height: 28px;
}

:deep(.el-date-editor.el-input__wrapper) {
  width: 303px;
}

.icon {
  cursor: pointer;
}

.clear {
  @media (max-width: 407px) {
    position: absolute;
    top: 41px;
    left: 242px;
  }
}

:deep(.reload) {
  @media (max-width: 407px) {
    position: absolute;
    top: 42px;
    left: 208px;
  }
}
</style>
