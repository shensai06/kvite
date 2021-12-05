<template>
  <div>{{ title + ":" + num }}</div>
  <button @click="handleClick">增加</button>
</template>

<script>
import { ref } from "vue";
export default {
  setup() {
    const title = ref("hello, kvite!");
    let num = ref(1);
    function handleClick() {
      num.value += 1;
    }
    return { title, num, handleClick };
  },
};
</script>
<style>

div{
  background-color:red;
}
</style>